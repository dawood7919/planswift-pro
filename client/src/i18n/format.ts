import type { CalibrationScale, MeasurementUnit } from "@shared/takeoff-core";

export type AppLocale = "ar" | "en";
export type UnitSystem = "metric" | "imperial";
export type CalibratedUnit = CalibrationScale["unit"];

const METERS_PER_UNIT: Record<CalibratedUnit, number> = { m: 1, ft: 0.3048, cm: 0.01, in: 0.0254 };
const METERS_PER_FOOT = 0.3048;
const METERS_PER_YARD = METERS_PER_FOOT * 3;

function number(value: number, locale: AppLocale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale === "ar" ? "ar" : "en-US", { maximumFractionDigits }).format(value);
}

function asMeters(value: number, unit: CalibratedUnit) { return value * METERS_PER_UNIT[unit]; }
function fromMeters(value: number, unit: "m" | "ft") { return value / METERS_PER_UNIT[unit]; }

export function formatFeetInches(feet: number) {
  const sign = feet < 0 ? "-" : "";
  const absolute = Math.abs(feet);
  let wholeFeet = Math.floor(absolute);
  let inches = Math.round((absolute - wholeFeet) * 12);
  if (inches === 12) { wholeFeet += 1; inches = 0; }
  return `${sign}${wholeFeet}' ${inches}\"`;
}

export function formatLength(value: number, sourceUnit: CalibratedUnit, system: UnitSystem, locale: AppLocale) {
  const target = system === "metric" ? "m" : "ft";
  const converted = fromMeters(asMeters(value, sourceUnit), target);
  return system === "imperial" ? `${number(converted, locale)} ft` : `${number(converted, locale)} m`;
}

export function formatArea(value: number, sourceUnit: CalibratedUnit, system: UnitSystem, locale: AppLocale) {
  const squareMeters = asMeters(value, sourceUnit) ** 2;
  const converted = system === "metric" ? squareMeters : squareMeters / (METERS_PER_FOOT ** 2);
  return `${number(converted, locale)} ${system === "metric" ? "m²" : "SF"}`;
}

export function formatVolume(value: number, sourceUnit: CalibratedUnit, system: UnitSystem, locale: AppLocale) {
  const cubicMeters = asMeters(value, sourceUnit) ** 3;
  const converted = system === "metric" ? cubicMeters : cubicMeters / (METERS_PER_YARD ** 3);
  return `${number(converted, locale)} ${system === "metric" ? "m³" : "CY"}`;
}

export function formatCount(value: number, locale: AppLocale) { return `${number(value, locale, 0)} ${locale === "ar" ? "عدد" : "EA"}`; }

export function formatQuantity(value: number, unitCode: string | MeasurementUnit | null, locale: AppLocale = "ar", system: UnitSystem = "metric") {
  if (unitCode && typeof unitCode !== "string") {
    if (unitCode.kind === "COUNT") return formatCount(value, locale);
    if (unitCode.kind === "AREA") return formatArea(value, unitCode.unit, system, locale);
    if (unitCode.kind === "VOLUME") return formatVolume(value, unitCode.unit, system, locale);
    return formatLength(value, unitCode.unit, system, locale);
  }
  if (!unitCode) return number(value, locale);
  if (unitCode === "COUNT") return formatCount(value, locale);
  const [kind, sourceUnit] = unitCode.split(":") as ["LENGTH" | "AREA" | "VOLUME" | undefined, CalibratedUnit | undefined];
  if (!kind || !sourceUnit) return number(value, locale);
  if (kind === "AREA") return formatArea(value, sourceUnit, system, locale);
  if (kind === "VOLUME") return formatVolume(value, sourceUnit, system, locale);
  return formatLength(value, sourceUnit, system, locale);
}

export function formatCurrency(value: number, currency: string, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
