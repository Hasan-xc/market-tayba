import { DbUsersService } from './db-users';

class CloudBackedDatabase extends DbUsersService {}

export const dbService = new CloudBackedDatabase();
/** وعد جهوزية القاعدة: يكتمل بعد ترحيلات PIN وكلمات المرور — main.tsx ينتظره قبل التركيب */
export const dbReady = dbService.ready;

export { DEFAULT_BRANCHES, DEFAULT_USERS, MIN_PASSWORD_LENGTH, DEFAULT_SETTINGS, SEED_PRODUCTS } from './db-core';
export type { OfflineMutation } from './db-core';
export { DbCore } from './db-core';
export { DbInventoryService } from './db-inventory';
export { DbCustomersService } from './db-customers';
export { DbSalesService } from './db-sales';
export { DbSettingsService } from './db-settings';
export { DbUsersService } from './db-users';
