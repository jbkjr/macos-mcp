/**
 * Messages Types
 * TypeScript interfaces for iMessage/SMS functionality
 */

export interface MessageHandle {
  id: string;
  identifier: string; // phone number or email
  service: string; // 'iMessage' or 'SMS'
}

export interface MessageChat {
  id: string;
  guid: string;
  chatIdentifier: string; // phone/email or group ID
  displayName?: string; // for named groups
  isGroup: boolean;
  participants: MessageHandle[];
  lastMessageDate?: string; // ISO 8601
  lastMessageText?: string;
}

export interface Message {
  id: string;
  guid: string;
  text: string;
  date: string; // ISO 8601
  isFromMe: boolean;
  chatId: string;
  senderHandle?: string; // phone/email of sender (for group chats)
  hasAttachments: boolean;
  attachmentIds?: string[];
}

export interface MessageAttachment {
  id: string;
  guid: string;
  filename: string; // full path
  mimeType?: string;
  transferName?: string; // original filename
  totalBytes?: number;
  messageId: string;
}

export interface Contact {
  id: string;
  fullName: string;
  givenName?: string;
  familyName?: string;
  phoneNumbers: ContactPhoneNumber[];
  emailAddresses: ContactEmail[];
}

export interface ContactPhoneNumber {
  label?: string;
  number: string;
}

export interface ContactEmail {
  label?: string;
  email: string;
}

export interface SendMessageResult {
  success: boolean;
  recipient: string;
  message?: string;
  error?: string;
}

export interface DeleteResult {
  deleted: boolean;
  id?: string;
}
