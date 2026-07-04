#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const VEHICLE_COLUMNS = [
  'id',
  'vin',
  'condition',
  'year',
  'make',
  'model',
  'trim',
  'body_type',
  'drive_type',
  'fuel_type',
  'transmission',
  'engine',
  'horsepower',
  'mpg_city',
  'mpg_highway',
  'seats',
  'doors',
  'mileage',
  'price',
  'msrp',
  'exterior_color',
  'interior_color',
  'description',
  'key_features',
  'use_case_tags',
  'priority_tags',
  'image_url',
  'dealer_name',
  'dealer_zip',
  'source_name',
  'source_url',
  'in_stock',
  'featured',
  'last_updated_at'
];

const REQUIRED_FIELDS = ['id', 'condition', 'year', 'make', 'model', 'body_type', 'price'];

function argValue(name, fallback = '') {
  const prefixed = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function usage() {
  console.error(`Usage:
  npm run catalog:import -- --input ./vehicles.json > db/imported-vehicles.sql

Input must be a JSON array of objects matching backend/db/schema.sql vehicle columns.
Array fields such as key_features, use_case_tags, and priority_tags are serialized to JSON text.`);
}

function sqlValue(value) {
  if (value === undefined || value === null || value === '') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = Array.isArray(value) || (typeof value === 'object' && value !== null)
    ? JSON.stringify(value)
    : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function normalizeVehicle(input) {
  const vehicle = { ...input };
  for (const key of ['key_features', 'use_case_tags', 'priority_tags']) {
    if (typeof vehicle[key] === 'string') {
      try {
        const parsed = JSON.parse(vehicle[key]);
        if (Array.isArray(parsed)) vehicle[key] = parsed;
      } catch {
        vehicle[key] = vehicle[key].split(',').map((item) => item.trim()).filter(Boolean);
      }
    }
  }
  vehicle.in_stock = vehicle.in_stock ?? 1;
  vehicle.featured = vehicle.featured ?? 0;
  vehicle.last_updated_at = vehicle.last_updated_at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return vehicle;
}

function validateVehicle(vehicle, index) {
  const missing = REQUIRED_FIELDS.filter((field) => vehicle[field] === undefined || vehicle[field] === null || vehicle[field] === '');
  if (missing.length) {
    throw new Error(`Vehicle at index ${index} is missing required field(s): ${missing.join(', ')}`);
  }
  if (!Number.isFinite(Number(vehicle.year))) {
    throw new Error(`Vehicle ${vehicle.id} has invalid year: ${vehicle.year}`);
  }
  if (!Number.isFinite(Number(vehicle.price))) {
    throw new Error(`Vehicle ${vehicle.id} has invalid price: ${vehicle.price}`);
  }
}

function loadVehicles(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array of vehicle records.');
  }
  return parsed.map((vehicle, index) => {
    const normalized = normalizeVehicle(vehicle);
    validateVehicle(normalized, index);
    return normalized;
  });
}

function toSql(vehicles) {
  const rows = vehicles.map((vehicle) => {
    const values = VEHICLE_COLUMNS.map((column) => sqlValue(vehicle[column]));
    return `(${values.join(', ')})`;
  });
  return `INSERT OR REPLACE INTO vehicles (
  ${VEHICLE_COLUMNS.join(',\n  ')}
) VALUES
${rows.join(',\n')};`;
}

const input = argValue('input');
if (!input) {
  usage();
  process.exit(1);
}

try {
  const vehicles = loadVehicles(input);
  console.log(`-- Generated from ${input} on ${new Date().toISOString()}`);
  console.log(toSql(vehicles));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
