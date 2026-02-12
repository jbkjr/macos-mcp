/**
 * Contacts Types
 * TypeScript interfaces for macOS Contacts functionality
 */

export interface ContactPhoneNumber {
  label?: string;
  number: string;
}

export interface ContactEmail {
  label?: string;
  email: string;
}

export interface ContactPostalAddress {
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isoCountryCode?: string;
}

export interface ContactURL {
  label?: string;
  url: string;
}

export interface Contact {
  id: string;
  fullName: string;
  givenName?: string;
  familyName?: string;
  middleName?: string;
  namePrefix?: string;
  nameSuffix?: string;
  nickname?: string;
  phoneNumbers: ContactPhoneNumber[];
  emailAddresses: ContactEmail[];
  postalAddresses: ContactPostalAddress[];
  urlAddresses: ContactURL[];
  organizationName?: string;
  jobTitle?: string;
  departmentName?: string;
  birthday?: string;
  note?: string;
  imageAvailable: boolean;
}

export interface ContactSearchResult {
  contacts: Contact[];
}

export interface ContactListResult {
  contacts: Contact[];
  totalCount: number;
}

export interface ContactGroup {
  id: string;
  name: string;
}

export interface DeleteResult {
  id: string;
  deleted: boolean;
}
