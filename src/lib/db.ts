import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

export type UserRole = 'admin' | 'staff' | 'customer';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  createdAt: string;
}

export interface DbOtp {
  id: string;
  email: string;
  otp: string;
  expiresAt: string;
  createdAt: string;
}

export interface DbOrder {
  id: string;
  customerId: string;
  product: string;
  amount: number;
  status: string;
  stage: string;
  dueDate: string;
  assignedWorker?: string;
}

export interface DbInventoryItem {
  id: string;
  name: string;
  category: string;
  supplier: string;
  stockLevel: number;
  minStock: number;
  unit: string;
  location: string;
  lastUpdated: string;
  status: string;
}

export interface DbData {
  users: DbUser[];
  otps: DbOtp[];
  orders: DbOrder[];
  inventory: DbInventoryItem[];
}

function ensureDb() {
  const folder = path.dirname(DB_PATH);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    throw new Error('Database file missing: ' + DB_PATH);
  }
}

export function readDb(): DbData {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw) as DbData;
}

export function writeDb(data: DbData) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function findUserByEmail(email: string) {
  const db = readDb();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string) {
  const db = readDb();
  return db.users.find((user) => user.id === id);
}

export function updateUser(updated: DbUser) {
  const db = readDb();
  const index = db.users.findIndex((user) => user.id === updated.id);
  if (index === -1) throw new Error('User not found');
  db.users[index] = updated;
  writeDb(db);
  return updated;
}

export function addOtp(otpRecord: DbOtp) {
  const db = readDb();
  db.otps.push(otpRecord);
  writeDb(db);
}

export function findOtp(email: string, code: string) {
  const db = readDb();
  return db.otps.find((record) => record.email.toLowerCase() === email.toLowerCase() && record.otp === code);
}

export function removeOtp(id: string) {
  const db = readDb();
  db.otps = db.otps.filter((record) => record.id !== id);
  writeDb(db);
}
