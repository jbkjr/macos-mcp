/**
 * Contacts Tool Definitions
 * Zod schemas for macOS Contacts MCP tools
 */

import { z } from 'zod';

const phoneSchema = z.object({
  label: z.string().optional().describe('Label (e.g. "mobile", "home", "work")'),
  number: z.string().describe('Phone number'),
});

const emailSchema = z.object({
  label: z.string().optional().describe('Label (e.g. "home", "work")'),
  email: z.string().describe('Email address'),
});

const postalAddressSchema = z.object({
  label: z.string().optional().describe('Label (e.g. "home", "work")'),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isoCountryCode: z.string().optional(),
});

const urlSchema = z.object({
  label: z.string().optional().describe('Label (e.g. "homepage", "home", "work")'),
  url: z.string().describe('URL'),
});

export const searchContactsSchema = z.object({
  name: z.string().optional().describe('Search contacts by name'),
  phone: z.string().optional().describe('Search contacts by phone number'),
  email: z.string().optional().describe('Search contacts by email address'),
});

export const getContactSchema = z.object({
  id: z.string().describe('The unique identifier of the contact'),
});

export const listContactsSchema = z.object({
  groupId: z.string().optional().describe('Filter contacts by group ID'),
  limit: z.number().optional().describe('Maximum number of contacts to return (default: 200)'),
});

export const listContactGroupsSchema = z.object({});

export const createContactSchema = z.object({
  givenName: z.string().optional().describe('First name'),
  familyName: z.string().optional().describe('Last name'),
  middleName: z.string().optional().describe('Middle name'),
  namePrefix: z.string().optional().describe('Name prefix (e.g. "Dr.", "Mr.")'),
  nameSuffix: z.string().optional().describe('Name suffix (e.g. "Jr.", "III")'),
  nickname: z.string().optional().describe('Nickname'),
  organizationName: z.string().optional().describe('Company or organization name'),
  jobTitle: z.string().optional().describe('Job title'),
  departmentName: z.string().optional().describe('Department name'),
  phoneNumbers: z.array(phoneSchema).optional().describe('Phone numbers'),
  emailAddresses: z.array(emailSchema).optional().describe('Email addresses'),
  postalAddresses: z.array(postalAddressSchema).optional().describe('Postal addresses'),
  urlAddresses: z.array(urlSchema).optional().describe('URLs'),
  birthday: z.string().optional().describe('Birthday (format: "YYYY-MM-DD" or "--MM-DD" for no year)'),
  note: z.string().optional().describe('Notes about the contact'),
});

export const updateContactSchema = z.object({
  id: z.string().describe('The unique identifier of the contact to update'),
  givenName: z.string().optional().describe('First name'),
  familyName: z.string().optional().describe('Last name'),
  middleName: z.string().optional().describe('Middle name'),
  namePrefix: z.string().optional().describe('Name prefix (e.g. "Dr.", "Mr.")'),
  nameSuffix: z.string().optional().describe('Name suffix (e.g. "Jr.", "III")'),
  nickname: z.string().optional().describe('Nickname'),
  organizationName: z.string().optional().describe('Company or organization name'),
  jobTitle: z.string().optional().describe('Job title'),
  departmentName: z.string().optional().describe('Department name'),
  phoneNumbers: z.array(phoneSchema).optional().describe('Phone numbers (replaces all existing)'),
  emailAddresses: z.array(emailSchema).optional().describe('Email addresses (replaces all existing)'),
  postalAddresses: z.array(postalAddressSchema).optional().describe('Postal addresses (replaces all existing)'),
  urlAddresses: z.array(urlSchema).optional().describe('URLs (replaces all existing)'),
  birthday: z.string().optional().describe('Birthday (format: "YYYY-MM-DD", "--MM-DD", or empty string to remove)'),
  note: z.string().optional().describe('Notes about the contact'),
});

export const deleteContactSchema = z.object({
  id: z.string().describe('The unique identifier of the contact to delete'),
});
