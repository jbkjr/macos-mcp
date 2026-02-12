/**
 * Contacts Service
 * Business logic for macOS Contacts operations via Swift CLI
 */

import { executeCli } from '../utils/eventkit-cli.js';
import type {
  Contact,
  ContactSearchResult,
  ContactListResult,
  ContactGroup,
  DeleteResult,
} from './types.js';

function addOptionalArgs(
  args: string[],
  options: Record<string, string | number | boolean | undefined>,
  mapping: Record<string, string>
): void {
  for (const [key, flag] of Object.entries(mapping)) {
    const value = options[key];
    if (value !== undefined) {
      args.push(flag, String(value));
    }
  }
}

export class ContactsService {
  async searchContacts(options: {
    name?: string;
    phone?: string;
    email?: string;
  }): Promise<Contact[]> {
    const args = ['--action', 'search-contacts'];
    addOptionalArgs(args, options, {
      name: '--name',
      phone: '--phone',
      email: '--email',
    });
    const result = await executeCli<ContactSearchResult>(args);
    return result.contacts;
  }

  async getContact(id: string): Promise<Contact> {
    return executeCli<Contact>(['--action', 'get-contact', '--id', id]);
  }

  async listContacts(options?: {
    groupId?: string;
    limit?: number;
  }): Promise<ContactListResult> {
    const args = ['--action', 'list-contacts'];
    if (options) {
      addOptionalArgs(args, options, {
        groupId: '--groupId',
        limit: '--limit',
      });
    }
    return executeCli<ContactListResult>(args);
  }

  async listGroups(): Promise<ContactGroup[]> {
    return executeCli<ContactGroup[]>(['--action', 'list-contact-groups']);
  }

  async createContact(options: {
    givenName?: string;
    familyName?: string;
    middleName?: string;
    namePrefix?: string;
    nameSuffix?: string;
    nickname?: string;
    organizationName?: string;
    jobTitle?: string;
    departmentName?: string;
    phoneNumbers?: { label?: string; number: string }[];
    emailAddresses?: { label?: string; email: string }[];
    postalAddresses?: Record<string, string | undefined>[];
    urlAddresses?: { label?: string; url: string }[];
    birthday?: string;
    note?: string;
  }): Promise<Contact> {
    const { phoneNumbers, emailAddresses, postalAddresses, urlAddresses, ...scalar } = options;
    const args = ['--action', 'create-contact'];
    addOptionalArgs(args, scalar, {
      givenName: '--givenName',
      familyName: '--familyName',
      middleName: '--middleName',
      namePrefix: '--namePrefix',
      nameSuffix: '--nameSuffix',
      nickname: '--nickname',
      organizationName: '--organizationName',
      jobTitle: '--jobTitle',
      departmentName: '--departmentName',
      birthday: '--birthday',
      note: '--note',
    });
    if (phoneNumbers) {
      args.push('--phones', JSON.stringify(phoneNumbers));
    }
    if (emailAddresses) {
      args.push('--emails', JSON.stringify(emailAddresses));
    }
    if (postalAddresses) {
      args.push('--addresses', JSON.stringify(postalAddresses));
    }
    if (urlAddresses) {
      args.push('--urls', JSON.stringify(urlAddresses));
    }
    return executeCli<Contact>(args);
  }

  async updateContact(
    id: string,
    updates: {
      givenName?: string;
      familyName?: string;
      middleName?: string;
      namePrefix?: string;
      nameSuffix?: string;
      nickname?: string;
      organizationName?: string;
      jobTitle?: string;
      departmentName?: string;
      phoneNumbers?: { label?: string; number: string }[];
      emailAddresses?: { label?: string; email: string }[];
      postalAddresses?: Record<string, string | undefined>[];
      urlAddresses?: { label?: string; url: string }[];
      birthday?: string;
      note?: string;
    }
  ): Promise<Contact> {
    const { phoneNumbers, emailAddresses, postalAddresses, urlAddresses, ...scalar } = updates;
    const args = ['--action', 'update-contact', '--id', id];
    addOptionalArgs(args, scalar, {
      givenName: '--givenName',
      familyName: '--familyName',
      middleName: '--middleName',
      namePrefix: '--namePrefix',
      nameSuffix: '--nameSuffix',
      nickname: '--nickname',
      organizationName: '--organizationName',
      jobTitle: '--jobTitle',
      departmentName: '--departmentName',
      birthday: '--birthday',
      note: '--note',
    });
    if (phoneNumbers) {
      args.push('--phones', JSON.stringify(phoneNumbers));
    }
    if (emailAddresses) {
      args.push('--emails', JSON.stringify(emailAddresses));
    }
    if (postalAddresses) {
      args.push('--addresses', JSON.stringify(postalAddresses));
    }
    if (urlAddresses) {
      args.push('--urls', JSON.stringify(urlAddresses));
    }
    return executeCli<Contact>(args);
  }

  async deleteContact(id: string): Promise<DeleteResult> {
    return executeCli<DeleteResult>(['--action', 'delete-contact', '--id', id]);
  }
}
