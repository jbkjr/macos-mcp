/**
 * Contacts Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContactsService } from './service.js';

// Mock the CLI executor
vi.mock('../utils/eventkit-cli.js', () => ({
  executeCli: vi.fn(),
}));

describe('ContactsService', () => {
  let service: ContactsService;
  let executeCliMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    service = new ContactsService();
    const cliModule = await import('../utils/eventkit-cli.js');
    executeCliMock = cliModule.executeCli as unknown as ReturnType<typeof vi.fn>;
    executeCliMock.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('searchContacts', () => {
    it('should search by name', async () => {
      const mockResult = {
        contacts: [
          { id: 'c1', fullName: 'John Doe', phoneNumbers: [], emailAddresses: [], postalAddresses: [], urlAddresses: [], imageAvailable: false },
        ],
      };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.searchContacts({ name: 'John' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'search-contacts', '--name', 'John']);
      expect(result).toEqual(mockResult.contacts);
    });

    it('should search by phone', async () => {
      executeCliMock.mockResolvedValue({ contacts: [] });

      await service.searchContacts({ phone: '+1234567890' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'search-contacts', '--phone', '+1234567890']);
    });

    it('should search by email', async () => {
      executeCliMock.mockResolvedValue({ contacts: [] });

      await service.searchContacts({ email: 'john@example.com' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'search-contacts', '--email', 'john@example.com']);
    });

    it('should propagate errors from CLI', async () => {
      executeCliMock.mockRejectedValue(new Error('CLI error'));

      await expect(service.searchContacts({ name: 'Test' })).rejects.toThrow('CLI error');
    });
  });

  describe('getContact', () => {
    it('should return single contact by ID', async () => {
      const mockContact = {
        id: 'c1',
        fullName: 'John Doe',
        givenName: 'John',
        familyName: 'Doe',
        phoneNumbers: [{ label: 'mobile', number: '+1234567890' }],
        emailAddresses: [],
        postalAddresses: [],
        urlAddresses: [],
        imageAvailable: false,
      };
      executeCliMock.mockResolvedValue(mockContact);

      const result = await service.getContact('c1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'get-contact', '--id', 'c1']);
      expect(result).toEqual(mockContact);
    });
  });

  describe('listContacts', () => {
    it('should list contacts without filters', async () => {
      const mockResult = { contacts: [], totalCount: 0 };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.listContacts();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'list-contacts']);
      expect(result).toEqual(mockResult);
    });

    it('should include groupId and limit parameters', async () => {
      executeCliMock.mockResolvedValue({ contacts: [], totalCount: 0 });

      await service.listContacts({ groupId: 'g1', limit: 50 });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'list-contacts',
        '--groupId', 'g1',
        '--limit', '50',
      ]);
    });
  });

  describe('listGroups', () => {
    it('should return list of groups', async () => {
      const mockGroups = [
        { id: 'g1', name: 'Friends' },
        { id: 'g2', name: 'Work' },
      ];
      executeCliMock.mockResolvedValue(mockGroups);

      const result = await service.listGroups();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'list-contact-groups']);
      expect(result).toEqual(mockGroups);
    });
  });

  describe('createContact', () => {
    it('should create contact with basic fields', async () => {
      const mockContact = {
        id: 'new-c1',
        fullName: 'Jane Smith',
        givenName: 'Jane',
        familyName: 'Smith',
        phoneNumbers: [],
        emailAddresses: [],
        postalAddresses: [],
        urlAddresses: [],
        imageAvailable: false,
      };
      executeCliMock.mockResolvedValue(mockContact);

      const result = await service.createContact({
        givenName: 'Jane',
        familyName: 'Smith',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-contact',
        '--givenName', 'Jane',
        '--familyName', 'Smith',
      ]);
      expect(result).toEqual(mockContact);
    });

    it('should include all optional fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.createContact({
        givenName: 'Jane',
        familyName: 'Smith',
        middleName: 'Marie',
        organizationName: 'Acme',
        jobTitle: 'Engineer',
        phoneNumbers: [{ label: 'mobile', number: '+1234567890' }],
        emailAddresses: [{ label: 'work', email: 'jane@acme.com' }],
        birthday: '1990-05-15',
        note: 'A note',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-contact',
        '--givenName', 'Jane',
        '--familyName', 'Smith',
        '--middleName', 'Marie',
        '--organizationName', 'Acme',
        '--jobTitle', 'Engineer',
        '--birthday', '1990-05-15',
        '--note', 'A note',
        '--phones', JSON.stringify([{ label: 'mobile', number: '+1234567890' }]),
        '--emails', JSON.stringify([{ label: 'work', email: 'jane@acme.com' }]),
      ]);
    });

    it('should include postal addresses and URLs', async () => {
      executeCliMock.mockResolvedValue({});

      await service.createContact({
        givenName: 'Jane',
        postalAddresses: [{ label: 'home', street: '123 Main St', city: 'Springfield' }],
        urlAddresses: [{ label: 'homepage', url: 'https://example.com' }],
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-contact',
        '--givenName', 'Jane',
        '--addresses', JSON.stringify([{ label: 'home', street: '123 Main St', city: 'Springfield' }]),
        '--urls', JSON.stringify([{ label: 'homepage', url: 'https://example.com' }]),
      ]);
    });
  });

  describe('updateContact', () => {
    it('should update contact with ID and scalar fields', async () => {
      const mockContact = {
        id: 'c1',
        fullName: 'John Updated',
        phoneNumbers: [],
        emailAddresses: [],
        postalAddresses: [],
        urlAddresses: [],
        imageAvailable: false,
      };
      executeCliMock.mockResolvedValue(mockContact);

      const result = await service.updateContact('c1', { givenName: 'John Updated' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-contact',
        '--id', 'c1',
        '--givenName', 'John Updated',
      ]);
      expect(result).toEqual(mockContact);
    });

    it('should include array fields in update', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateContact('c1', {
        phoneNumbers: [{ label: 'work', number: '+9876543210' }],
        emailAddresses: [{ label: 'home', email: 'new@example.com' }],
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-contact',
        '--id', 'c1',
        '--phones', JSON.stringify([{ label: 'work', number: '+9876543210' }]),
        '--emails', JSON.stringify([{ label: 'home', email: 'new@example.com' }]),
      ]);
    });
  });

  describe('deleteContact', () => {
    it('should delete contact by ID', async () => {
      const mockResult = { id: 'c1', deleted: true };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.deleteContact('c1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'delete-contact', '--id', 'c1']);
      expect(result).toEqual(mockResult);
    });
  });
});
