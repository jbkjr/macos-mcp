#!/bin/bash
# Live check that re-dating a reminder through the bridge moves what
# Reminders.app displays, not just EventKit's dueDate.
#
# Reminders.app shows the date of a reminder's absolute alarm, so a reminder
# created in the app (due date + alarm) keeps showing its old date if the
# bridge changes only dueDateComponents. This script:
#   1. creates a scratch list via the bridge,
#   2. creates an app-style reminder in it via AppleScript (due date + alarm),
#   3. re-dates it via the bridge and checks the app's display date and alarm,
#   4. clears the due date and checks the alarm is gone,
#   5. creates a timed reminder via the bridge and checks it gets an alarm,
#   6. deletes the scratch list.
#
# It reads Reminders' private Core Data store (read-only) as ground truth, so it
# needs Full Disk Access for the terminal and may break when Apple changes the
# schema. Run after `npm run build:swift`. Touches only the scratch list.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$PROJECT_ROOT/bin/MacOSMCPBridge.app"
LIST="zz-macos-mcp-alarm-check-$$"
STORES="$HOME/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores"
FAILED=0

bridge() {
    local tmp
    tmp=$(mktemp -d)
    /usr/bin/open -W -n --stdout "$tmp/out" --stderr "$tmp/err" "$APP" --args "$@" 2>/dev/null || true
    for _ in $(seq 1 150); do
        python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$tmp/out" 2>/dev/null && break
        sleep 0.1
    done
    cat "$tmp/out"
    rm -rf "$tmp"
}

json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'].get(sys.argv[1]) or '')" "$1"; }

# Prints "<display date> | <alarm trigger dates>" in local time for a reminder ID.
app_view() {
    local id=$1 db
    for db in "$STORES"/Data-*.sqlite; do
        sqlite3 "file:$db?mode=ro" "
            select coalesce(datetime(r.ZDISPLAYDATEDATE + 978307200, 'unixepoch', 'localtime'), '-') || ' | ' ||
                   coalesce((select group_concat(hex(t.ZDATECOMPONENTSDATA), ',')
                             from ZREMCDOBJECT a join ZREMCDOBJECT t on t.ZALARM = a.Z_PK
                             where a.ZREMINDER = r.Z_PK), '')
            from ZREMCDREMINDER r where r.ZDACALENDARITEMUNIQUEIDENTIFIER = '$id'" 2>/dev/null
    done | python3 -c '
import json, sys
from datetime import datetime
from zoneinfo import ZoneInfo
for line in sys.stdin:
    disp, _, alarms = line.rstrip("\n").partition(" | ")
    out = []
    for h in filter(None, alarms.split(",")):
        c = json.loads(bytes.fromhex(h))
        tz = c.get("timeZone", {}).get("identifier")
        t = datetime(c["year"], c["month"], c["day"], c.get("hour", 0), c.get("minute", 0), c.get("second", 0),
                     tzinfo=ZoneInfo(tz) if tz else None)
        out.append((t.astimezone() if tz else t).strftime("%Y-%m-%d %H:%M:%S"))
    print(disp + " | " + ",".join(out))'
}

expect() {
    local label=$1 want=$2 got=$3
    if [ "$got" = "$want" ]; then
        echo "ok   $label"
    else
        echo "FAIL $label: want '$want', got '$got'"
        FAILED=1
    fi
}

cleanup() { bridge --action delete-list --name "$LIST" >/dev/null; }

bridge --action create-list --name "$LIST" >/dev/null
trap cleanup EXIT

# App-style reminder: due date plus an absolute alarm at the same time.
uri=$(osascript -e "tell application \"Reminders\"
    set d to current date
    set {year of d, month of d, day of d, time of d} to {2030, 1, 15, 8 * hours}
    return id of (make new reminder at end of list \"$LIST\" with properties {name:\"alarm check\", due date:d, remind me date:d})
end tell")
id=${uri#x-apple-reminder://}
sleep 1
expect "app-created reminder" "2030-01-15 08:00:00 | 2030-01-15 08:00:00" "$(app_view "$id")"

bridge --action update-reminder --id "$id" --dueDate "2030-01-17 15:30:00" >/dev/null
sleep 1
expect "re-dated: display date and alarm follow" "2030-01-17 15:30:00 | 2030-01-17 15:30:00" "$(app_view "$id")"

bridge --action update-reminder --id "$id" --dueDate "" >/dev/null
sleep 1
expect "due date cleared: alarm removed" "- | " "$(app_view "$id")"

created=$(bridge --action create-reminder --title "bridge-created" --targetList "$LIST" --dueDate "2030-02-01 09:15:00" | json_field id)
sleep 1
expect "bridge-created timed reminder has alarm" "2030-02-01 09:15:00 | 2030-02-01 09:15:00" "$(app_view "$created")"

exit $FAILED
