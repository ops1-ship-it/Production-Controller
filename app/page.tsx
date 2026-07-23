"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  downloadBlob,
  fileStamp,
  ingredientExportColumns,
  ingredientImportColumns,
  makeCsvBlob,
  makeXlsxBlob,
  parseIngredientFile,
  supportedImportUnits,
  type IngredientFileRow,
} from "@/src/lib/ingredients/files";
import {
  countryByCode,
  countryByNameOrCode,
  countryCurrencyOptions,
  countryInputLabel,
  currencyDisplay,
  defaultCountryCurrency,
} from "@/src/lib/business/countries";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { normalizeSupabaseError } from "@/src/lib/supabase/errors";
import type { Json, Tables, TablesUpdate } from "@/src/lib/supabase/types";

type Unit =
  | "kg"
  | "g"
  | "L"
  | "ml"
  | "each"
  | "packet"
  | "bottle"
  | "tub"
  | "case"
  | "custom";

type Ingredient = {
  id: string;
  businessId?: string;
  categoryId?: string | null;
  supplierId?: string | null;
  name: string;
  category: string;
  description: string;
  supplier: string;
  sku: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCost: number;
  baseUnit: Unit;
  defaultWastage: number;
  notes: string;
  active: boolean;
  lastCostUpdate: string;
  createdAt: string;
  updatedAt: string;
};

type FormulaLine = {
  id: string;
  recipeVersionId?: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  isMain: boolean;
  optional: boolean;
  wastage: number;
  notes: string;
  sortOrder: number;
};

type MethodStep = {
  id: string;
  recipeVersionId?: string;
  title: string;
  instructions: string;
  duration: string;
  temperature: string;
  equipment: string;
  image: string;
  notes: string;
};

type AdditionalCost = {
  id: string;
  type: string;
  description: string;
  quantity: number;
  rate: number;
  notes: string;
};

type Recipe = {
  id: string;
  businessId?: string;
  versionId?: string;
  name: string;
  code: string;
  category: string;
  description: string;
  version: string;
  status: "Draft" | "Active" | "Archived";
  baseStartingQuantity: number;
  baseStartingUnit: Unit;
  expectedYield: number;
  yieldUnit: Unit;
  defaultAdditionalCost: number;
  defaultSellingUnit: string;
  pricingMethod: "Markup" | "Gross Margin";
  pricingPercentage: number;
  methodIntro: string;
  image: string;
  updatedAt: string;
  formulaLines: FormulaLine[];
  methodSteps: MethodStep[];
};

type ProductionLine = {
  id: string;
  productionBatchId?: string;
  ingredientId: string;
  baseQuantity: number;
  unit: Unit;
  requiredQuantity: number;
  actualQuantity: number;
  actualUnit: Unit;
  expectedCost: number;
  actualCost: number;
  costSnapshot: number;
  notes: string;
};

type ProductionBatch = {
  id: string;
  businessId?: string;
  locationId?: string | null;
  batchNumber: string;
  recipeId: string;
  recipeName: string;
  recipeVersion: string;
  status:
    | "Draft"
    | "In Progress"
    | "Resting"
    | "Drying"
    | "Awaiting Review"
    | "On Hold"
    | "Completed"
    | "Cancelled";
  mainQuantity: number;
  mainUnit: Unit;
  startDate: string;
  endDate: string;
  responsible: string;
  location: string;
  expectedCompletion: string;
  notes: string;
  outcomeNotes: string;
  completedBy: string;
  qualityRating: string;
  startingYield: number;
  completedYield: number;
  yieldUnit: Unit;
  methodSnapshot: MethodStep[];
  formulaSnapshot: FormulaLine[];
  lines: ProductionLine[];
  additionalCosts: AdditionalCost[];
  finalTotalCost?: number;
  finalCostPerYield?: number;
  finalSellingPrice?: number;
};

type Toast = {
  kind: "success" | "failed" | "warning" | "info";
  message: string;
};

type SupabaseLoadState =
  | "checking"
  | "unauthenticated"
  | "no-business"
  | "ready"
  | "failed";

type BusinessContext = {
  businessId: string;
  locationId: string | null;
  userId: string;
  userEmail: string;
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
};

type HomeAuthMode = "login" | "register" | "forgot" | "verify";

type RegistrationStep = "user" | "business" | "review";

type RegistrationDraft = {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  provinceRegion: string;
  postalCode: string;
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  confirmInformation: boolean;
  idempotencyKey: string;
};

type IngredientLookup = {
  id: string;
  name: string;
};

type IngredientImportMode = "add-only" | "add-update";

type MissingLookupMode = "create" | "reject";

type IngredientImportResult =
  | "Ready to Add"
  | "Ready to Update"
  | "Duplicate"
  | "Invalid"
  | "Skipped";

type IngredientImportDraftRow = {
  rowNumber: number;
  values: IngredientFileRow;
  name: string;
  category: string;
  supplier: string;
  sku: string;
  purchaseQuantity: number;
  purchaseUnit: Unit | "";
  purchaseCost: number;
  baseUnit: Unit | "";
  wastePercentage: number;
  active: boolean;
  notes: string;
  costPerBaseUnit: number;
  result: IngredientImportResult;
  message: string;
  existingId?: string;
};

const units: Unit[] = [
  "kg",
  "g",
  "L",
  "ml",
  "each",
  "packet",
  "bottle",
  "tub",
  "case",
  "custom",
];

const importUnits = [...supportedImportUnits] as Unit[];

const additionalCostTypes = [
  "Labour",
  "Electricity",
  "Packaging",
  "Labels",
  "Storage",
  "Delivery",
  "Equipment",
  "Other overhead",
];

const massUnits: Partial<Record<Unit, number>> = { kg: 1000, g: 1 };
const volumeUnits: Partial<Record<Unit, number>> = { L: 1000, ml: 1 };

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function convertQuantity(quantity: number, from: Unit, to: Unit) {
  if (!Number.isFinite(quantity)) return 0;
  if (from === to) return quantity;

  if (massUnits[from] && massUnits[to]) {
    return (quantity * massUnits[from]!) / massUnits[to]!;
  }

  if (volumeUnits[from] && volumeUnits[to]) {
    return (quantity * volumeUnits[from]!) / volumeUnits[to]!;
  }

  return quantity;
}

function normalizeTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalisedName(value: IngredientFileRow[string]) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseImportNumber(value: IngredientFileRow[string]) {
  const text = String(value ?? "")
    .replace(/[Rr]/g, "")
    .replace(/\s/g, "")
    .replaceAll(",", "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeImportUnit(value: IngredientFileRow[string]): Unit | "" {
  const text = String(value ?? "").trim().toLowerCase();
  return importUnits.find((unit) => unit.toLowerCase() === text) ?? "";
}

function statusToActive(value: IngredientFileRow[string]) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "active") return true;
  if (text === "inactive") return false;
  return null;
}

function strictConvertImportQuantity(quantity: number, from: Unit, to: Unit) {
  if (!Number.isFinite(quantity)) return null;
  if (from === to) return quantity;
  if (from === "kg" && to === "g") return quantity * 1000;
  if (from === "g" && to === "kg") return null;
  if (from === "L" && to === "ml") return quantity * 1000;
  if (from === "ml" && to === "L") return null;
  return null;
}

function calculateImportUnitCost(
  purchaseQuantity: number,
  purchaseUnit: Unit,
  purchaseCost: number,
  baseUnit: Unit,
) {
  const converted = strictConvertImportQuantity(
    purchaseQuantity,
    purchaseUnit,
    baseUnit,
  );
  return converted && converted > 0 ? purchaseCost / converted : 0;
}

function buildIngredientImportPreview({
  rawRows,
  ingredients,
  categories,
  suppliers,
  importMode,
  missingLookupMode,
}: {
  rawRows: IngredientFileRow[];
  ingredients: Ingredient[];
  categories: IngredientLookup[];
  suppliers: IngredientLookup[];
  importMode: IngredientImportMode;
  missingLookupMode: MissingLookupMode;
}) {
  const categoryMap = new Map(categories.map((item) => [normalizeTextKey(item.name), item]));
  const supplierMap = new Map(suppliers.map((item) => [normalizeTextKey(item.name), item]));
  const existingBySku = new Map(
    ingredients
      .filter((ingredient) => ingredient.sku.trim())
      .map((ingredient) => [normalizeTextKey(ingredient.sku), ingredient]),
  );
  const existingByName = new Map(
    ingredients.map((ingredient) => [normalizeTextKey(ingredient.name), ingredient]),
  );
  const seenImportKeys = new Set<string>();

  return rawRows.map((row, index) => {
    const name = normalisedName(row["Ingredient Name"]);
    const category = normalisedName(row.Category);
    const supplier = normalisedName(row.Supplier);
    const sku = normalisedName(row.SKU);
    const purchaseQuantity = parseImportNumber(row["Purchase Quantity"]);
    const purchaseUnit = normalizeImportUnit(row["Purchase UOM"]);
    const purchaseCost = parseImportNumber(row["Purchase Cost"]);
    const baseUnit = normalizeImportUnit(row["Recipe Base UOM"]);
    const wastePercentage = parseImportNumber(row["Waste Percentage"]);
    const active = statusToActive(row.Status);
    const notes = String(row.Notes ?? "").trim();
    const errors: string[] = [];

    if (!name) errors.push("Ingredient Name is required.");
    if (!Number.isFinite(purchaseQuantity) || purchaseQuantity <= 0) {
      errors.push("Purchase Quantity must be greater than zero.");
    }
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
      errors.push("Purchase Cost cannot be negative.");
    }
    if (!purchaseUnit) errors.push("Purchase UOM is not supported.");
    if (!baseUnit) errors.push("Recipe Base UOM is not supported.");
    if (purchaseUnit && baseUnit && strictConvertImportQuantity(1, purchaseUnit, baseUnit) === null) {
      errors.push("Purchase UOM and Recipe Base UOM are not compatible.");
    }
    if (!Number.isFinite(wastePercentage) || wastePercentage < 0 || wastePercentage > 100) {
      errors.push("Waste Percentage must be between 0 and 100.");
    }
    if (active === null) errors.push("Status must be Active or Inactive.");
    if (category.length > 120) errors.push("Category text is too long.");
    if (supplier.length > 160) errors.push("Supplier text is too long.");
    if (missingLookupMode === "reject" && category && !categoryMap.has(normalizeTextKey(category))) {
      errors.push("Category does not exist.");
    }
    if (missingLookupMode === "reject" && supplier && !supplierMap.has(normalizeTextKey(supplier))) {
      errors.push("Supplier does not exist.");
    }

    const importKey = sku ? `sku:${normalizeTextKey(sku)}` : `name:${normalizeTextKey(name)}`;
    const duplicateInFile = Boolean(name) && seenImportKeys.has(importKey);
    if (name) seenImportKeys.add(importKey);

    const existing = sku
      ? existingBySku.get(normalizeTextKey(sku))
      : existingByName.get(normalizeTextKey(name));
    const costPerBaseUnit =
      purchaseUnit && baseUnit && Number.isFinite(purchaseQuantity) && Number.isFinite(purchaseCost)
        ? calculateImportUnitCost(purchaseQuantity, purchaseUnit, purchaseCost, baseUnit)
        : 0;

    let result: IngredientImportResult = "Ready to Add";
    let message = "Validated.";
    if (errors.length) {
      result = "Invalid";
      message = errors.join(" ");
    } else if (duplicateInFile) {
      result = "Duplicate";
      message = "Duplicate row in this import file.";
    } else if (existing && importMode === "add-only") {
      result = "Duplicate";
      message = sku
        ? "Existing ingredient matches this SKU."
        : "Existing ingredient matches this name.";
    } else if (existing && importMode === "add-update") {
      result = "Ready to Update";
      message = "Existing ingredient will be updated.";
    }

    return {
      rowNumber: index + 2,
      values: row,
      name,
      category,
      supplier,
      sku,
      purchaseQuantity: Number.isFinite(purchaseQuantity) ? purchaseQuantity : 0,
      purchaseUnit,
      purchaseCost: Number.isFinite(purchaseCost) ? purchaseCost : 0,
      baseUnit,
      wastePercentage: Number.isFinite(wastePercentage) ? wastePercentage : 0,
      active: active ?? true,
      notes,
      costPerBaseUnit,
      result,
      message,
      existingId: existing?.id,
    } satisfies IngredientImportDraftRow;
  });
}

function ingredientImportSummary(rows: IngredientImportDraftRow[]) {
  return {
    totalRows: rows.length,
    readyToAdd: rows.filter((row) => row.result === "Ready to Add").length,
    readyToUpdate: rows.filter((row) => row.result === "Ready to Update").length,
    duplicates: rows.filter((row) => row.result === "Duplicate").length,
    invalidRows: rows.filter((row) => row.result === "Invalid").length,
    skippedRows: rows.filter((row) => row.result === "Skipped").length,
  };
}

function ingredientExportRow(ingredient: Ingredient): IngredientFileRow {
  return {
    "Ingredient Name": ingredient.name,
    Category: ingredient.category,
    Supplier: ingredient.supplier,
    SKU: ingredient.sku,
    "Purchase Quantity": ingredient.purchaseQuantity,
    "Purchase UOM": ingredient.purchaseUnit,
    "Purchase Cost": ingredient.purchaseCost,
    "Recipe Base UOM": ingredient.baseUnit,
    "Cost Per Base Unit": Number(ingredientUnitCost(ingredient).toFixed(4)),
    "Waste Percentage": ingredient.defaultWastage,
    Status: ingredient.active ? "Active" : "Inactive",
    Notes: ingredient.notes,
  };
}

function importErrorReportRow(row: IngredientImportDraftRow): IngredientFileRow {
  return {
    "Original Row Number": row.rowNumber,
    ...Object.fromEntries(
      ingredientImportColumns.map((column) => [column, row.values[column] ?? ""]),
    ),
    "Import Result": row.result,
    "Validation Message": row.message,
  };
}

function ingredientUnitCost(ingredient: Ingredient) {
  const convertedPurchaseQuantity = convertQuantity(
    ingredient.purchaseQuantity,
    ingredient.purchaseUnit,
    ingredient.baseUnit,
  );
  return convertedPurchaseQuantity > 0
    ? ingredient.purchaseCost / convertedPurchaseQuantity
    : 0;
}

function formulaLineCost(
  line: FormulaLine,
  ingredientMap: Map<string, Ingredient>,
) {
  const ingredient = ingredientMap.get(line.ingredientId);
  if (!ingredient) return 0;
  const quantityInBaseUnit = convertQuantity(
    line.quantity,
    line.unit,
    ingredient.baseUnit,
  );
  return quantityInBaseUnit * ingredientUnitCost(ingredient) * (1 + line.wastage / 100);
}

function recipeMainLine(recipe: Recipe) {
  return (
    recipe.formulaLines.find((line) => line.isMain) ?? recipe.formulaLines[0]
  );
}

function recipeMainIngredient(recipe: Recipe, ingredientMap: Map<string, Ingredient>) {
  const mainLine = recipeMainLine(recipe);
  return mainLine
    ? (ingredientMap.get(mainLine.ingredientId)?.name ?? "Unassigned")
    : "Unassigned";
}

function recipeFormulaCost(recipe: Recipe, ingredientMap: Map<string, Ingredient>) {
  return recipe.formulaLines.reduce(
    (sum, line) => sum + formulaLineCost(line, ingredientMap),
    0,
  );
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+()\-\s.]/g, "").replace(/\s+/g, " ");
}

function passwordStrengthErrors(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Use at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/\d/.test(password)) errors.push("Add a number.");
  return errors;
}

function formatCurrency(
  value: number,
  digits = 2,
  currencyCode = "ZAR",
  countryCode = "ZA",
) {
  const country = countryByCode(countryCode);
  return new Intl.NumberFormat(country.locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sellingUnitQuantity(unit: string) {
  if (unit === "Per kg") return 1;
  if (unit === "Per 500 g") return 0.5;
  if (unit === "Per 250 g") return 0.25;
  if (unit === "Per 100 g") return 0.1;
  if (unit === "Per packet") return 0.25;
  if (unit === "Per portion") return 0.125;
  if (unit === "Per item") return 0.1;
  return 1;
}

function sellingPrice(cost: number, method: Recipe["pricingMethod"], percentage: number) {
  if (method === "Markup") return cost * (1 + percentage / 100);
  return percentage >= 100 ? 0 : cost / (1 - percentage / 100);
}

function todayStamp() {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function productionLinesForRecipe(
  recipe: Recipe,
  mainQuantity: number,
  mainUnit: Unit,
  ingredientMap: Map<string, Ingredient>,
) {
  const mainLine = recipeMainLine(recipe);
  const mainQuantityInBaseUnit = mainLine
    ? convertQuantity(mainQuantity, mainUnit, mainLine.unit)
    : mainQuantity;
  const scalingFactor =
    mainLine && mainLine.quantity > 0 ? mainQuantityInBaseUnit / mainLine.quantity : 1;

  return recipe.formulaLines.map((line) => {
    const ingredient = ingredientMap.get(line.ingredientId);
    const requiredQuantity = line.quantity * scalingFactor;
    const costSnapshot = ingredient ? ingredientUnitCost(ingredient) : 0;
    const expectedQuantityInBaseUnit = ingredient
      ? convertQuantity(requiredQuantity, line.unit, ingredient.baseUnit)
      : requiredQuantity;
    const expectedCost = expectedQuantityInBaseUnit * costSnapshot;

    return {
      id: makeId("prod-line"),
      ingredientId: line.ingredientId,
      baseQuantity: line.quantity,
      unit: line.unit,
      requiredQuantity,
      actualQuantity: requiredQuantity,
      actualUnit: line.unit,
      expectedCost,
      actualCost: expectedCost,
      costSnapshot,
      notes: "",
    };
  });
}

type IngredientSelect = Tables<"ingredients"> & {
  ingredient_categories?: Pick<Tables<"ingredient_categories">, "name"> | null;
  suppliers?: Pick<Tables<"suppliers">, "name"> | null;
};

type ProductionStatusRow = Tables<"production_batches">["status"];

function recipeStatusFromDb(status: string): Recipe["status"] {
  if (status === "active") return "Active";
  if (status === "archived") return "Archived";
  return "Draft";
}

function recipeStatusToDb(status: Recipe["status"]) {
  if (status === "Active") return "active";
  if (status === "Archived") return "archived";
  return "draft";
}

function productionStatusFromDb(status: ProductionStatusRow): ProductionBatch["status"] {
  const statusMap: Record<string, ProductionBatch["status"]> = {
    draft: "Draft",
    in_progress: "In Progress",
    resting: "Resting",
    drying: "Drying",
    awaiting_review: "Awaiting Review",
    on_hold: "On Hold",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return statusMap[status] ?? "Draft";
}

function productionStatusToDb(status: ProductionBatch["status"]) {
  const statusMap: Record<ProductionBatch["status"], string> = {
    Draft: "draft",
    "In Progress": "in_progress",
    Resting: "resting",
    Drying: "drying",
    "Awaiting Review": "awaiting_review",
    "On Hold": "on_hold",
    Completed: "completed",
    Cancelled: "cancelled",
  };
  return statusMap[status];
}

function pricingMethodFromDb(method: string | null): Recipe["pricingMethod"] {
  return method === "markup" ? "Markup" : "Gross Margin";
}

function pricingMethodToDb(method: Recipe["pricingMethod"]) {
  return method === "Markup" ? "markup" : "gross_margin";
}

function sellingUnitFromDb(quantity: number | null, unit: string | null) {
  if (quantity === 0.5 && unit === "kg") return "Per 500 g";
  if (quantity === 0.25 && unit === "kg") return "Per 250 g";
  if (quantity === 0.1 && unit === "kg") return "Per 100 g";
  if (unit === "packet") return "Per packet";
  if (unit === "portion") return "Per portion";
  if (unit === "item") return "Per item";
  return "Per kg";
}

function sellingUnitToDb(unit: string) {
  if (unit === "Per 500 g") return { quantity: 0.5, uom: "kg" };
  if (unit === "Per 250 g") return { quantity: 0.25, uom: "kg" };
  if (unit === "Per 100 g") return { quantity: 0.1, uom: "kg" };
  if (unit === "Per packet") return { quantity: 1, uom: "packet" };
  if (unit === "Per portion") return { quantity: 1, uom: "portion" };
  if (unit === "Per item") return { quantity: 1, uom: "item" };
  return { quantity: 1, uom: "kg" };
}

function mapIngredient(row: IngredientSelect): Ingredient {
  return {
    id: row.id,
    businessId: row.business_id,
    categoryId: row.category_id,
    supplierId: row.supplier_id,
    name: row.name,
    category: row.ingredient_categories?.name ?? "Uncategorised",
    description: row.description ?? "",
    supplier: row.suppliers?.name ?? "",
    sku: row.sku ?? "",
    purchaseQuantity: Number(row.purchase_quantity),
    purchaseUnit: row.purchase_uom as Unit,
    purchaseCost: Number(row.purchase_cost),
    baseUnit: row.recipe_base_uom as Unit,
    defaultWastage: Number(row.default_wastage_percentage),
    notes: row.notes ?? "",
    active: row.is_active,
    lastCostUpdate: new Date(row.updated_at).toLocaleDateString("en-ZA"),
    createdAt: new Date(row.created_at).toLocaleDateString("en-ZA"),
    updatedAt: new Date(row.updated_at).toLocaleDateString("en-ZA"),
  };
}

function mapFormulaLine(row: Tables<"recipe_formula_lines">): FormulaLine {
  return {
    id: row.id,
    recipeVersionId: row.recipe_version_id,
    ingredientId: row.ingredient_id,
    quantity: Number(row.formula_quantity),
    unit: row.formula_uom as Unit,
    isMain: row.is_main_ingredient,
    optional: row.is_optional,
    wastage: Number(row.wastage_percentage),
    notes: row.notes ?? "",
    sortOrder: row.sort_order,
  };
}

function mapMethodStep(row: Tables<"recipe_method_steps">): MethodStep {
  return {
    id: row.id,
    recipeVersionId: row.recipe_version_id,
    title: row.title ?? "",
    instructions: row.instructions,
    duration: row.duration_minutes ? `${row.duration_minutes} min` : "",
    temperature:
      row.temperature_value && row.temperature_uom
        ? `${row.temperature_value} ${row.temperature_uom}`
        : "",
    equipment: row.equipment ?? "",
    image: row.image_path ?? "",
    notes: row.notes ?? "",
  };
}

function mapRecipe(
  row: Tables<"recipes">,
  version: Tables<"recipe_versions">,
  formulaLines: Tables<"recipe_formula_lines">[],
  methodSteps: Tables<"recipe_method_steps">[],
): Recipe {
  return {
    id: row.id,
    businessId: row.business_id,
    versionId: version.id,
    name: row.name,
    code: row.recipe_code ?? "",
    category: row.category ?? "",
    description: row.description ?? "",
    version: version.version_number.toString(),
    status: recipeStatusFromDb(row.status),
    baseStartingQuantity: Number(version.base_main_quantity),
    baseStartingUnit: version.base_main_uom as Unit,
    expectedYield: Number(version.expected_yield ?? 0),
    yieldUnit: (version.expected_yield_uom ?? version.base_main_uom) as Unit,
    defaultAdditionalCost: Number(version.estimated_additional_cost),
    defaultSellingUnit: sellingUnitFromDb(
      version.default_selling_unit_quantity,
      version.default_selling_unit_uom,
    ),
    pricingMethod: pricingMethodFromDb(version.default_pricing_method),
    pricingPercentage: Number(version.default_pricing_percentage ?? 0),
    methodIntro: version.method_introduction ?? "",
    image: "",
    updatedAt: new Date(row.updated_at).toLocaleString("en-ZA"),
    formulaLines: formulaLines
      .filter((line) => line.recipe_version_id === version.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapFormulaLine),
    methodSteps: methodSteps
      .filter((step) => step.recipe_version_id === version.id)
      .sort((a, b) => a.step_number - b.step_number)
      .map(mapMethodStep),
  };
}

function mapProductionLine(row: Tables<"production_ingredient_lines">): ProductionLine {
  return {
    id: row.id,
    productionBatchId: row.production_batch_id,
    ingredientId: row.ingredient_id,
    baseQuantity: Number(row.formula_quantity),
    unit: row.formula_uom as Unit,
    requiredQuantity: Number(row.calculated_quantity),
    actualQuantity: Number(row.actual_quantity ?? row.calculated_quantity),
    actualUnit: (row.actual_uom ?? row.calculated_uom) as Unit,
    expectedCost: Number(row.expected_line_cost),
    actualCost: Number(row.actual_line_cost ?? row.expected_line_cost),
    costSnapshot: Number(row.ingredient_cost_snapshot),
    notes: row.notes ?? "",
  };
}

function mapProductionMethodStep(row: Tables<"production_method_steps">): MethodStep {
  return {
    id: row.id,
    title: row.title ?? "",
    instructions: row.instructions,
    duration: row.duration_minutes ? `${row.duration_minutes} min` : "",
    temperature:
      row.temperature_value && row.temperature_uom
        ? `${row.temperature_value} ${row.temperature_uom}`
        : "",
    equipment: row.equipment ?? "",
    image: "",
    notes: row.notes ?? "",
  };
}

function mapProductionCost(row: Tables<"production_additional_costs">): AdditionalCost {
  return {
    id: row.id,
    type: row.cost_type,
    description: row.description ?? "",
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    notes: row.notes ?? "",
  };
}

function mapProduction(
  row: Tables<"production_batches">,
  recipeName: string,
  recipeVersion: string,
  lines: Tables<"production_ingredient_lines">[],
  methodSteps: Tables<"production_method_steps">[],
  additionalCosts: Tables<"production_additional_costs">[],
): ProductionBatch {
  return {
    id: row.id,
    businessId: row.business_id,
    locationId: row.location_id,
    batchNumber: row.batch_number,
    recipeId: row.recipe_id,
    recipeName,
    recipeVersion,
    status: productionStatusFromDb(row.status),
    mainQuantity: Number(row.actual_main_quantity),
    mainUnit: row.actual_main_uom as Unit,
    startDate: row.start_datetime ?? "",
    endDate: row.end_datetime ?? "",
    responsible: row.responsible_user_id ?? "",
    location: row.location_id ?? "",
    expectedCompletion: "",
    notes: "",
    outcomeNotes: row.outcome_notes ?? "",
    completedBy: row.completed_by ?? "",
    qualityRating: row.quality_rating?.toString() ?? "",
    startingYield: Number(row.starting_yield ?? row.actual_main_quantity),
    completedYield: Number(row.completed_yield ?? 0),
    yieldUnit: (row.completed_yield_uom ?? row.actual_main_uom) as Unit,
    methodSnapshot: methodSteps
      .filter((step) => step.production_batch_id === row.id)
      .sort((a, b) => a.step_number - b.step_number)
      .map(mapProductionMethodStep),
    formulaSnapshot: [],
    lines: lines
      .filter((line) => line.production_batch_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapProductionLine),
    additionalCosts: additionalCosts
      .filter((cost) => cost.production_batch_id === row.id)
      .map(mapProductionCost),
    finalTotalCost: Number(row.total_production_cost),
    finalCostPerYield: Number(row.cost_per_selling_unit ?? 0),
    finalSellingPrice: Number(row.final_selling_price ?? row.recommended_selling_price_ex_vat ?? 0),
  };
}

function fieldLabel(label: string, required?: boolean) {
  return (
    <span>
      {label}
      {required ? <b aria-label="required">*</b> : null}
    </span>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
      {fieldLabel(label, required)}
      {children}
    </label>
  );
}

function UnitSelect({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value as Unit)}
    >
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  step = "0.01",
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      disabled={disabled}
      type="number"
      min="0"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(toNumber(event.target.value))}
    />
  );
}

type AppData = {
  ingredients: Ingredient[];
  recipes: Recipe[];
  productions: ProductionBatch[];
};

const emptyAppData: AppData = {
  ingredients: [],
  recipes: [],
  productions: [],
};

function defaultRegistrationDraft(): RegistrationDraft {
  const country = defaultCountryCurrency;
  return {
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    provinceRegion: "",
    postalCode: "",
    countryCode: country.countryCode,
    currencyCode: country.defaultCurrencyCode,
    currencySymbol: country.currencySymbol,
    timezone: country.defaultTimezone,
    confirmInformation: false,
    idempotencyKey: makeId("registration"),
  };
}

export default function RecipeCostApp({
  initialPath = "/",
}: {
  initialPath?: string;
}) {
  const [route, setRoute] = useState(initialPath);
  const [ingredients, setIngredients] = useState(emptyAppData.ingredients);
  const [recipes, setRecipes] = useState(emptyAppData.recipes);
  const [productions, setProductions] = useState(emptyAppData.productions);
  const [activeRecipeId, setActiveRecipeId] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [toast, setToast] = useState<Toast | null>(null);
  const [supabaseState, setSupabaseState] =
    useState<SupabaseLoadState>("checking");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(
    null,
  );
  const [ingredientCategories, setIngredientCategories] = useState<IngredientLookup[]>([]);
  const [ingredientSuppliers, setIngredientSuppliers] = useState<IngredientLookup[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [homeAuthMode, setHomeAuthMode] = useState<HomeAuthMode>("login");
  const [registrationStep, setRegistrationStep] =
    useState<RegistrationStep>("user");
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft>(
    () => defaultRegistrationDraft(),
  );
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [countrySearch, setCountrySearch] = useState(
    countryInputLabel(defaultCountryCurrency),
  );
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [mutationLabel, setMutationLabel] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [startingProduction, setStartingProduction] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] =
    useState<IngredientImportMode>("add-only");
  const [missingLookupMode, setMissingLookupMode] =
    useState<MissingLookupMode>("create");
  const [importFileName, setImportFileName] = useState("");
  const [importRawRows, setImportRawRows] = useState<IngredientFileRow[]>([]);
  const [importProcessing, setImportProcessing] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [productionDraft, setProductionDraft] = useState({
    recipeId: "",
    mainQuantity: 1,
    mainUnit: "kg" as Unit,
    startDate: "",
    responsible: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    const readRoute = () =>
      setRoute(`${window.location.pathname}${window.location.search}`);
    readRoute();
    window.addEventListener("popstate", readRoute);
    return () => window.removeEventListener("popstate", readRoute);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(
      () => setToast(null),
      toast.kind === "failed" ? 3200 : 2100,
    );
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const pathname = route.split("?")[0] || "/dashboard";
  const query = useMemo(
    () => new URLSearchParams(route.split("?")[1] ?? ""),
    [route],
  );
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );
  const activeRecipe =
    recipes.find((recipe) => recipe.id === activeRecipeId) ?? recipes[0] ?? null;
  const selectedProductionRecipe =
    recipes.find((recipe) => recipe.id === productionDraft.recipeId) ??
    activeRecipe;
  const formatMoney = useCallback(
    (value: number, digits = 2) =>
      formatCurrency(
        value,
        digits,
        businessContext?.currencyCode ?? defaultCountryCurrency.defaultCurrencyCode,
        businessContext?.countryCode ?? defaultCountryCurrency.countryCode,
      ),
    [businessContext],
  );

  const recipeRows = useMemo(
    () =>
      recipes.map((recipe) => {
        const formulaCost = recipeFormulaCost(recipe, ingredientMap);
        const expectedTotal = formulaCost + recipe.defaultAdditionalCost;
        const costPerYield =
          recipe.expectedYield > 0 ? expectedTotal / recipe.expectedYield : 0;
        return {
          ...recipe,
          mainIngredient: recipeMainIngredient(recipe, ingredientMap),
          formulaCost,
          expectedTotal,
          costPerYield,
        };
      }),
    [ingredientMap, recipes],
  );

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        const matchesSearch =
          ingredient.name.toLowerCase().includes(ingredientSearch.toLowerCase()) ||
          ingredient.sku.toLowerCase().includes(ingredientSearch.toLowerCase());
        const matchesCategory =
          categoryFilter === "All" || ingredient.category === categoryFilter;
        const matchesSupplier =
          supplierFilter === "All" || ingredient.supplier === supplierFilter;
        const matchesActive =
          activeFilter === "All" ||
          (activeFilter === "Active" ? ingredient.active : !ingredient.active);
        return matchesSearch && matchesCategory && matchesSupplier && matchesActive;
      }),
    [activeFilter, categoryFilter, ingredientSearch, ingredients, supplierFilter],
  );

  const importRows = useMemo(
    () =>
      importRawRows.length
        ? buildIngredientImportPreview({
            rawRows: importRawRows,
            ingredients,
            categories: ingredientCategories,
            suppliers: ingredientSuppliers,
            importMode,
            missingLookupMode,
          })
        : [],
    [
      importMode,
      importRawRows,
      ingredients,
      ingredientCategories,
      ingredientSuppliers,
      missingLookupMode,
    ],
  );

  const productionDraftLines = useMemo(
    () =>
      selectedProductionRecipe
        ? productionLinesForRecipe(
            selectedProductionRecipe,
            productionDraft.mainQuantity,
            productionDraft.mainUnit,
            ingredientMap,
          )
        : [],
    [
      ingredientMap,
      productionDraft.mainQuantity,
      productionDraft.mainUnit,
      selectedProductionRecipe,
    ],
  );

  const activeProductions = productions.filter((production) =>
    ["In Progress", "Resting", "Drying", "Awaiting Review", "On Hold"].includes(
      production.status,
    ),
  );
  const completedProductions = productions.filter(
    (production) => production.status === "Completed",
  );

  const navigate = (href: string) => {
    const targetPath = href.split("?")[0] || "/";
    const nextHref =
      targetPath !== "/" && supabaseState === "unauthenticated"
        ? `/?next=${encodeURIComponent(href)}`
        : href;
    window.history.pushState(null, "", nextHref);
    setRoute(`${window.location.pathname}${window.location.search}`);
  };

  const showToast = useCallback((kind: Toast["kind"], message: string) => {
    setToast({ kind, message });
  }, []);

  const resetAppData = useCallback(() => {
    setIngredients(emptyAppData.ingredients);
    setRecipes(emptyAppData.recipes);
    setProductions(emptyAppData.productions);
    setIngredientCategories([]);
    setIngredientSuppliers([]);
    setActiveRecipeId("");
    setProductionDraft((current) => ({ ...current, recipeId: "" }));
  }, []);

  const loadSupabaseData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      setCurrentUser(user);
      if (!user) {
        resetAppData();
        setBusinessContext(null);
        setSupabaseState("unauthenticated");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_business_id, default_location_id")
        .eq("id", user.id)
        .maybeSingle();

      const membershipQuery = supabase
        .from("business_users")
        .select("business_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      const { data: membershipData, error: membershipError } =
        profileData?.default_business_id
          ? await membershipQuery
              .eq("business_id", profileData.default_business_id)
              .maybeSingle()
          : await membershipQuery.maybeSingle();

      if (membershipError) throw membershipError;

      const membership = membershipData as Pick<
        Tables<"business_users">,
        "business_id" | "role"
      > | null;

      if (!membership) {
        resetAppData();
        setBusinessContext(null);
        setSupabaseState("no-business");
        return;
      }

      const { data: locationMembership } = await supabase
        .from("location_users")
        .select("location_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const businessId = membership.business_id;
      const locationId =
        profileData?.default_location_id ??
        locationMembership?.location_id ??
        null;

      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("country_code, currency_code, currency_symbol")
        .eq("id", businessId)
        .maybeSingle();

      if (businessError) throw businessError;

      const [
        ingredientsResult,
        categoriesResult,
        suppliersResult,
        recipesResult,
        versionsResult,
        productionResult,
      ] = await Promise.all([
        supabase
          .from("ingredients")
          .select("*, ingredient_categories(name), suppliers(name)")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
        supabase
          .from("ingredient_categories")
          .select("id, name")
          .or(`business_id.eq.${businessId},business_id.is.null`)
          .order("name", { ascending: true }),
        supabase
          .from("suppliers")
          .select("id, name")
          .or(`business_id.eq.${businessId},business_id.is.null`)
          .order("name", { ascending: true }),
        supabase
          .from("recipes")
          .select("*")
          .eq("business_id", businessId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("recipe_versions")
          .select("*")
          .eq("is_current", true)
          .order("version_number", { ascending: false }),
        supabase
          .from("production_batches")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (ingredientsResult.error) throw ingredientsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (recipesResult.error) throw recipesResult.error;
      if (versionsResult.error) throw versionsResult.error;
      if (productionResult.error) throw productionResult.error;

      const ingredientRows = (ingredientsResult.data ?? []) as IngredientSelect[];
      const categoryRows = (categoriesResult.data ?? []) as IngredientLookup[];
      const supplierRows = (suppliersResult.data ?? []) as IngredientLookup[];
      const recipeRowsFromDb = recipesResult.data ?? [];
      const currentVersions = (versionsResult.data ?? []).filter((version) =>
        recipeRowsFromDb.some((recipe) => recipe.id === version.recipe_id),
      );
      const versionIds = currentVersions.map((version) => version.id);
      const productionRows = productionResult.data ?? [];
      const productionIds = productionRows.map((production) => production.id);

      const [formulaResult, methodResult, productionLineResult, productionMethodResult, costResult] =
        await Promise.all([
          versionIds.length
            ? supabase
                .from("recipe_formula_lines")
                .select("*")
                .in("recipe_version_id", versionIds)
                .order("sort_order", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          versionIds.length
            ? supabase
                .from("recipe_method_steps")
                .select("*")
                .in("recipe_version_id", versionIds)
                .order("step_number", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          productionIds.length
            ? supabase
                .from("production_ingredient_lines")
                .select("*")
                .in("production_batch_id", productionIds)
                .order("sort_order", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          productionIds.length
            ? supabase
                .from("production_method_steps")
                .select("*")
                .in("production_batch_id", productionIds)
                .order("step_number", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          productionIds.length
            ? supabase
                .from("production_additional_costs")
                .select("*")
                .in("production_batch_id", productionIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (formulaResult.error) throw formulaResult.error;
      if (methodResult.error) throw methodResult.error;
      if (productionLineResult.error) throw productionLineResult.error;
      if (productionMethodResult.error) throw productionMethodResult.error;
      if (costResult.error) throw costResult.error;

      const formulas = formulaResult.data as Tables<"recipe_formula_lines">[];
      const methods = methodResult.data as Tables<"recipe_method_steps">[];
      const productionLines =
        productionLineResult.data as Tables<"production_ingredient_lines">[];
      const productionMethods =
        productionMethodResult.data as Tables<"production_method_steps">[];
      const productionCosts =
        costResult.data as Tables<"production_additional_costs">[];

      const versionByRecipeId = new Map(
        currentVersions.map((version) => [version.recipe_id, version]),
      );
      const versionById = new Map(currentVersions.map((version) => [version.id, version]));
      const recipeById = new Map(recipeRowsFromDb.map((recipe) => [recipe.id, recipe]));

      const mappedRecipes = recipeRowsFromDb
        .map((recipe) => {
          const version = versionByRecipeId.get(recipe.id);
          return version ? mapRecipe(recipe, version, formulas, methods) : null;
        })
        .filter((recipe): recipe is Recipe => Boolean(recipe));

      const mappedProductions = productionRows.map((production) => {
        const recipe = recipeById.get(production.recipe_id);
        const version = versionById.get(production.recipe_version_id);
        return mapProduction(
          production,
          recipe?.name ?? "Archived recipe",
          version?.version_number.toString() ?? "snapshot",
          productionLines,
          productionMethods,
          productionCosts,
        );
      });

      setIngredients(ingredientRows.map(mapIngredient));
      setIngredientCategories(categoryRows);
      setIngredientSuppliers(supplierRows);
      setRecipes(mappedRecipes);
      setProductions(mappedProductions);
      setBusinessContext({
        businessId,
        locationId,
        userId: user.id,
        userEmail: user.email ?? "",
        countryCode: businessData?.country_code ?? defaultCountryCurrency.countryCode,
        currencyCode:
          businessData?.currency_code ?? defaultCountryCurrency.defaultCurrencyCode,
        currencySymbol:
          businessData?.currency_symbol ?? defaultCountryCurrency.currencySymbol,
      });
      setActiveRecipeId((current) =>
        mappedRecipes.some((recipe) => recipe.id === current)
          ? current
          : (mappedRecipes[0]?.id ?? ""),
      );
      setProductionDraft((current) => ({
        ...current,
        recipeId: mappedRecipes.some((recipe) => recipe.id === current.recipeId)
          ? current.recipeId
          : (mappedRecipes[0]?.id ?? ""),
        responsible: current.responsible || user.email || "",
        location: current.location || locationId || "",
        startDate: current.startDate || new Date().toISOString().slice(0, 16),
      }));
      setSupabaseState("ready");
    } catch (error) {
      resetAppData();
      setSupabaseState("failed");
      showToast("failed", normalizeSupabaseError(error));
    } finally {
      setIsDataLoading(false);
    }
  }, [resetAppData, showToast]);

  useEffect(() => {
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      void loadSupabaseData();
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = supabase.auth.onAuthStateChange(() => {
          void loadSupabaseData();
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        setSupabaseState("failed");
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [loadSupabaseData]);

  const runSupabaseMutation = async (
    label: string,
    successMessage: string,
    action: () => Promise<void>,
  ) => {
    setMutationLabel(label);
    try {
      await action();
      await loadSupabaseData();
      showToast("success", successMessage);
    } catch (error) {
      showToast("failed", normalizeSupabaseError(error));
    } finally {
      setMutationLabel("");
    }
  };

  const updateRegistrationDraft = (patch: Partial<RegistrationDraft>) => {
    setRegistrationDraft((current) => ({ ...current, ...patch }));
  };

  const handleCountrySelection = (value: string) => {
    setCountrySearch(value);
    const country = countryByNameOrCode(value);
    if (!country) return;
    updateRegistrationDraft({
      countryCode: country.countryCode,
      currencyCode: country.defaultCurrencyCode,
      currencySymbol: country.currencySymbol,
      timezone: country.defaultTimezone,
    });
  };

  const validateLogin = () => {
    const email = authEmail.trim().toLowerCase();
    if (!email) return "Email is required.";
    if (!isValidEmail(email)) return "Enter a valid email address.";
    if (!loginPassword) return "Password is required.";
    return "";
  };

  const submitLogin = async () => {
    if (authSubmitting) return;
    const validationError = validateLogin();
    if (validationError) {
      showToast("failed", validationError);
      return;
    }

    setAuthSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
      window.localStorage.setItem("remember-production-controller", rememberMe ? "yes" : "no");
      await loadSupabaseData();
      showToast("success", "You have logged in successfully.");
      navigate("/dashboard");
    } catch {
      showToast("failed", "The email address or password is incorrect.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const submitForgotPassword = async () => {
    if (authSubmitting) return;
    const email = authEmail.trim().toLowerCase();
    if (!email) {
      showToast("failed", "Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      showToast("failed", "Enter a valid email address.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/`,
        },
      );
      if (error) throw error;
      showToast("success", "If an account exists, a password reset email has been sent.");
      setHomeAuthMode("login");
    } catch {
      showToast("failed", "The password reset email could not be sent. Try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const validateRegistrationUser = () => {
    const email = registrationDraft.email.trim().toLowerCase();
    const passwordErrors = passwordStrengthErrors(registrationDraft.password);
    if (!registrationDraft.firstName.trim()) return "First Name is required.";
    if (!registrationDraft.lastName.trim()) return "Last Name is required.";
    if (!email) return "Email Address is required.";
    if (!isValidEmail(email)) return "Enter a valid email address.";
    if (!registrationDraft.contactNumber.trim()) return "Contact Number is required.";
    if (!registrationDraft.password) return "Password is required.";
    if (passwordErrors.length) return passwordErrors.join(" ");
    if (registrationDraft.confirmPassword !== registrationDraft.password) {
      return "Confirm Password must match Password.";
    }
    return "";
  };

  const validateRegistrationBusiness = () => {
    const country = countryByCode(registrationDraft.countryCode);
    if (!registrationDraft.businessName.trim()) return "Business Name is required.";
    if (!country.countryCode) return "Country is required.";
    if (!registrationDraft.currencyCode.trim()) return "Currency is required.";
    return "";
  };

  const advanceRegistration = () => {
    const validationError =
      registrationStep === "user"
        ? validateRegistrationUser()
        : validateRegistrationBusiness();
    if (validationError) {
      showToast("failed", validationError);
      return;
    }
    setRegistrationStep(registrationStep === "user" ? "business" : "review");
  };

  const submitRegistration = async () => {
    if (authSubmitting) return;
    const validationError =
      validateRegistrationUser() || validateRegistrationBusiness();
    if (validationError) {
      showToast("failed", validationError);
      return;
    }
    if (!registrationDraft.confirmInformation) {
      showToast("failed", "Confirm that the information provided is correct.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const country = countryByCode(registrationDraft.countryCode);
      const email = registrationDraft.email.trim().toLowerCase();
      const { data, error } = await createSupabaseBrowserClient().auth.signUp({
        email,
        password: registrationDraft.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            registration_intent: "owner_business",
            registration_idempotency_key: registrationDraft.idempotencyKey,
            first_name: registrationDraft.firstName.trim(),
            last_name: registrationDraft.lastName.trim(),
            email,
            contact_number: normalizePhone(registrationDraft.contactNumber),
            country_calling_code: country.callingCode,
            business_name: registrationDraft.businessName.trim(),
            address_line_1: registrationDraft.addressLine1.trim(),
            address_line_2: registrationDraft.addressLine2.trim(),
            city: registrationDraft.city.trim(),
            province_region: registrationDraft.provinceRegion.trim(),
            postal_code: registrationDraft.postalCode.trim(),
            country_code: country.countryCode,
            currency_code: registrationDraft.currencyCode.trim().toUpperCase(),
            currency_symbol: registrationDraft.currencySymbol.trim(),
            timezone: registrationDraft.timezone,
          },
        },
      });
      if (error) throw error;

      setVerificationEmail(email);
      if (data.session) {
        await loadSupabaseData();
        showToast("success", "Your account and business have been created.");
        setRegistrationDraft(defaultRegistrationDraft());
        setRegistrationStep("user");
        navigate("/dashboard");
      } else {
        setHomeAuthMode("verify");
        showToast("success", "Check your email to complete registration.");
      }
    } catch {
      showToast(
        "failed",
        "Registration could not be completed. Review the details and try again.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const resendVerificationEmail = async () => {
    const email = verificationEmail || registrationDraft.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      showToast("failed", "Enter a valid email address to resend verification.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      showToast("success", "Verification email sent.");
    } catch {
      showToast("failed", "Verification email could not be sent. Try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const signOut = async () => {
    await runSupabaseMutation("Signing out", "Signed out.", async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      resetAppData();
      setBusinessContext(null);
      setCurrentUser(null);
      setSupabaseState("unauthenticated");
    });
    navigate("/");
  };

  const requireBusinessContext = () => {
    if (!businessContext) {
      throw new Error("Sign in and select a business before saving changes.");
    }
    return businessContext;
  };

  const downloadCurrentIngredientsCsv = () => {
    const rows = filteredIngredients.map(ingredientExportRow);
    downloadBlob(
      makeCsvBlob(rows, ingredientExportColumns),
      `ingredients-list-${fileStamp()}.csv`,
    );
    setExportMenuOpen(false);
    showToast("success", "Current ingredient list exported as CSV.");
  };

  const downloadCurrentIngredientsXlsx = () => {
    const rows = filteredIngredients.map(ingredientExportRow);
    downloadBlob(
      makeXlsxBlob([
        {
          name: "Ingredients",
          rows: [
            [...ingredientExportColumns],
            ...rows.map((row) =>
              ingredientExportColumns.map((column) => row[column] ?? ""),
            ),
          ],
          widths: [22, 16, 18, 16, 16, 13, 14, 15, 17, 16, 12, 28],
          freezeHeader: true,
          autoFilter: true,
          currencyColumns: [6],
          currency4Columns: [8],
          numericColumns: [4, 9],
          currencySymbol:
            businessContext?.currencySymbol ?? defaultCountryCurrency.currencySymbol,
        },
      ]),
      `ingredients-list-${fileStamp()}.xlsx`,
    );
    setExportMenuOpen(false);
    showToast("success", "Current ingredient list exported as XLSX.");
  };

  const templateExampleRow: IngredientFileRow = {
    "Ingredient Name": "Silverside",
    Category: "Meat",
    Supplier: "Karoo Butchery",
    SKU: "MEAT-SILV-5KG",
    "Purchase Quantity": 5,
    "Purchase UOM": "kg",
    "Purchase Cost": 685,
    "Recipe Base UOM": "g",
    "Waste Percentage": 0,
    Status: "Active",
    Notes: "Beef silverside for biltong production",
  };

  const downloadIngredientTemplateCsv = () => {
    downloadBlob(
      makeCsvBlob([templateExampleRow], ingredientImportColumns),
      "ingredients-import-template.csv",
    );
    setExportMenuOpen(false);
    showToast("success", "CSV import template downloaded.");
  };

  const downloadIngredientTemplateXlsx = () => {
    downloadBlob(
      makeXlsxBlob([
        {
          name: "Ingredients Import",
          rows: [
            [...ingredientImportColumns],
            ingredientImportColumns.map((column) => templateExampleRow[column] ?? ""),
          ],
          widths: [22, 16, 18, 16, 16, 13, 14, 15, 16, 12, 34],
          freezeHeader: true,
          autoFilter: true,
          currencyColumns: [6],
          numericColumns: [4, 8],
          currencySymbol:
            businessContext?.currencySymbol ?? defaultCountryCurrency.currencySymbol,
          dropdowns: {
            5: importUnits,
            7: importUnits,
            9: ["Active", "Inactive"],
          },
        },
        {
          name: "Instructions",
          rows: [
            ["Instruction"],
            ["Ingredient Name is required."],
            ["Purchase Quantity must be greater than zero."],
            ["Purchase Cost cannot be negative."],
            [`Supported UOM values: ${importUnits.join(", ")}.`],
            ["Recipe Base UOM must be compatible with Purchase UOM."],
            ["Waste Percentage must be between 0 and 100."],
            ["Status must be Active or Inactive."],
            ["SKU should be unique within the business."],
            ["Cost Per Base Unit is calculated automatically."],
            ["Existing ingredients may be updated according to the selected import mode."],
          ],
          widths: [86],
          freezeHeader: true,
        },
      ]),
      "ingredients-import-template.xlsx",
    );
    setExportMenuOpen(false);
    showToast("success", "XLSX import template downloaded.");
  };

  const openIngredientImportDialog = () => {
    setImportDialogOpen(true);
    setExportMenuOpen(false);
  };

  const clearIngredientImport = () => {
    setImportFileName("");
    setImportRawRows([]);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const handleIngredientFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportProcessing(true);
    try {
      const rows = await parseIngredientFile(file);
      if (!rows.length) {
        throw new Error("No ingredient rows were found in the selected file.");
      }
      const missingColumns = ingredientImportColumns.filter(
        (column) => !(column in rows[0]),
      );
      if (missingColumns.length) {
        throw new Error(`Missing columns: ${missingColumns.join(", ")}.`);
      }
      setImportFileName(file.name);
      setImportRawRows(rows);
      showToast("success", `${rows.length} ingredient rows loaded for preview.`);
    } catch (error) {
      clearIngredientImport();
      showToast("failed", normalizeSupabaseError(error));
    } finally {
      setImportProcessing(false);
    }
  };

  const exportIngredientErrorReportCsv = () => {
    const rows = importRows
      .filter((row) => ["Duplicate", "Invalid", "Skipped"].includes(row.result))
      .map(importErrorReportRow);
    downloadBlob(
      makeCsvBlob(rows, [
        "Original Row Number",
        ...ingredientImportColumns,
        "Import Result",
        "Validation Message",
      ]),
      `ingredient-import-errors-${fileStamp()}.csv`,
    );
  };

  const exportIngredientErrorReportXlsx = () => {
    const rows = importRows
      .filter((row) => ["Duplicate", "Invalid", "Skipped"].includes(row.result))
      .map(importErrorReportRow);
    const columns = [
      "Original Row Number",
      ...ingredientImportColumns,
      "Import Result",
      "Validation Message",
    ];
    downloadBlob(
      makeXlsxBlob([
        {
          name: "Ingredient Import Errors",
          rows: [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))],
          widths: [18, 22, 16, 18, 16, 16, 13, 14, 15, 16, 12, 30, 16, 38],
          freezeHeader: true,
          autoFilter: true,
        },
      ]),
      `ingredient-import-errors-${fileStamp()}.xlsx`,
    );
  };

  const confirmIngredientImport = async () => {
    const rowsToImport = importRows.filter((row) =>
      ["Ready to Add", "Ready to Update"].includes(row.result),
    );
    if (!rowsToImport.length) {
      showToast("failed", "No valid ingredient rows are ready to import.");
      return;
    }

    setImportProcessing(true);
    try {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const [categoryResult, supplierResult] = await Promise.all([
        supabase
          .from("ingredient_categories")
          .select("id, name")
          .eq("business_id", context.businessId),
        supabase
          .from("suppliers")
          .select("id, name")
          .eq("business_id", context.businessId),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (supplierResult.error) throw supplierResult.error;

      const categoryMap = new Map(
        ((categoryResult.data ?? []) as IngredientLookup[]).map((category) => [
          normalizeTextKey(category.name),
          category,
        ]),
      );
      const supplierMap = new Map(
        ((supplierResult.data ?? []) as IngredientLookup[]).map((supplier) => [
          normalizeTextKey(supplier.name),
          supplier,
        ]),
      );

      if (missingLookupMode === "create") {
        const missingCategoryNames = Array.from(
          new Map(
            rowsToImport
              .map((row) => row.category)
              .filter((name) => name && !categoryMap.has(normalizeTextKey(name)))
              .map((name) => [normalizeTextKey(name), name]),
          ).values(),
        );
        const missingSupplierNames = Array.from(
          new Map(
            rowsToImport
              .map((row) => row.supplier)
              .filter((name) => name && !supplierMap.has(normalizeTextKey(name)))
              .map((name) => [normalizeTextKey(name), name]),
          ).values(),
        );

        if (missingCategoryNames.length) {
          const { data, error } = await supabase
            .from("ingredient_categories")
            .insert(
              missingCategoryNames.map((name) => ({
                business_id: context.businessId,
                name,
              })),
            )
            .select("id, name");
          if (error) throw error;
          ((data ?? []) as IngredientLookup[]).forEach((category) =>
            categoryMap.set(normalizeTextKey(category.name), category),
          );
        }

        if (missingSupplierNames.length) {
          const { data, error } = await supabase
            .from("suppliers")
            .insert(
              missingSupplierNames.map((name) => ({
                business_id: context.businessId,
                name,
              })),
            )
            .select("id, name");
          if (error) throw error;
          ((data ?? []) as IngredientLookup[]).forEach((supplier) =>
            supplierMap.set(normalizeTextKey(supplier.name), supplier),
          );
        }
      }

      const skippedAtSave: IngredientImportDraftRow[] = [];
      const addPayload: Record<string, unknown>[] = [];
      const updatePayload: Record<string, unknown>[] = [];

      rowsToImport.forEach((row) => {
        const categoryId = row.category
          ? categoryMap.get(normalizeTextKey(row.category))?.id
          : null;
        const supplierId = row.supplier
          ? supplierMap.get(normalizeTextKey(row.supplier))?.id
          : null;
        if ((row.category && !categoryId) || (row.supplier && !supplierId)) {
          skippedAtSave.push({
            ...row,
            result: "Skipped",
            message: "Category or supplier could not be resolved at save time.",
          });
          return;
        }

        const payload = {
          business_id: context.businessId,
          category_id: categoryId ?? null,
          supplier_id: supplierId ?? null,
          name: row.name,
          description: null,
          sku: row.sku || null,
          purchase_quantity: row.purchaseQuantity,
          purchase_uom: row.purchaseUnit,
          purchase_cost: row.purchaseCost,
          recipe_base_uom: row.baseUnit,
          cost_per_base_unit: row.costPerBaseUnit,
          default_wastage_percentage: row.wastePercentage,
          notes: row.notes || null,
          is_active: row.active,
          created_by: context.userId,
        };

        if (row.result === "Ready to Update" && row.existingId) {
          updatePayload.push({ id: row.existingId, ...payload });
        } else {
          addPayload.push(payload);
        }
      });

      if (addPayload.length) {
        const { error } = await supabase.from("ingredients").insert(addPayload);
        if (error) throw error;
      }
      if (updatePayload.length) {
        const { error } = await supabase
          .from("ingredients")
          .upsert(updatePayload, { onConflict: "id" });
        if (error) throw error;
      }

      const summary = ingredientImportSummary(importRows);
      const skippedRows =
        summary.duplicates + summary.skippedRows + skippedAtSave.length;
      const invalidRows = summary.invalidRows;
      const errorRows = importRows.filter((row) =>
        ["Duplicate", "Invalid", "Skipped"].includes(row.result),
      );
      const errorSummary = [
        ...errorRows,
        ...skippedAtSave,
      ]
        .slice(0, 20)
        .map((row) => `Row ${row.rowNumber}: ${row.message}`)
        .join(" | ");

      let auditWarning = false;
      const { data: auditData, error: auditError } = await supabase
        .from("ingredient_imports")
        .insert({
          business_id: context.businessId,
          file_name: importFileName || "ingredient-import",
          file_type: importFileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
          import_mode: importMode,
          imported_by: context.userId,
          total_rows: summary.totalRows,
          added_rows: addPayload.length,
          updated_rows: updatePayload.length,
          skipped_rows: skippedRows,
          invalid_rows: invalidRows,
          error_summary: errorSummary || null,
        })
        .select("id")
        .maybeSingle();

      if (!auditError && auditData?.id) {
        const rowAuditPayload = [...importRows, ...skippedAtSave].map((row) => ({
          import_id: auditData.id,
          business_id: context.businessId,
          original_row_number: row.rowNumber,
          imported_values: row.values as Json,
          import_result: row.result,
          validation_message: row.message || null,
        }));
        if (rowAuditPayload.length) {
          const { error } = await supabase
            .from("ingredient_import_rows")
            .insert(rowAuditPayload);
          if (error) auditWarning = true;
        }
      } else if (auditError) {
        auditWarning = true;
      }

      await loadSupabaseData();
      setImportDialogOpen(false);
      clearIngredientImport();

      const actionSummary = [
        addPayload.length ? `${addPayload.length} ingredients added` : "",
        updatePayload.length ? `${updatePayload.length} ingredients updated` : "",
      ]
        .filter(Boolean)
        .join(" and ");
      if (auditWarning) {
        showToast(
          "warning",
          `${actionSummary}. Import audit could not be saved; apply the Supabase import audit migration.`,
        );
      } else if (skippedRows || invalidRows) {
        showToast(
          "warning",
          `${actionSummary}. ${skippedRows + invalidRows} rows were skipped due to validation errors.`,
        );
      } else {
        showToast("success", `${actionSummary}.`);
      }
    } catch (error) {
      showToast(
        "failed",
        normalizeSupabaseError(error) ||
          "The ingredient file could not be imported. Review the file format and try again.",
      );
    } finally {
      setImportProcessing(false);
    }
  };

  const updateIngredient = (id: string, patch: Partial<Ingredient>) => {
    const currentIngredient = ingredients.find((ingredient) => ingredient.id === id);
    if (!currentIngredient) return;
    const nextIngredient = { ...currentIngredient, ...patch };
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id
          ? { ...nextIngredient, updatedAt: todayStamp() }
          : ingredient,
      ),
    );

    void runSupabaseMutation("Saving ingredient", "Ingredient saved.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const categoryId =
        "category" in patch
          ? (ingredientCategories.find(
              (category) =>
                normalizeTextKey(category.name) === normalizeTextKey(nextIngredient.category),
            )?.id ?? null)
          : (nextIngredient.categoryId ?? null);
      const supplierId =
        "supplier" in patch
          ? (ingredientSuppliers.find(
              (supplier) =>
                normalizeTextKey(supplier.name) === normalizeTextKey(nextIngredient.supplier),
            )?.id ?? null)
          : (nextIngredient.supplierId ?? null);
      const { error } = await supabase
        .from("ingredients")
        .update({
          category_id: categoryId,
          supplier_id: supplierId,
          name: nextIngredient.name,
          description: nextIngredient.description,
          sku: nextIngredient.sku || null,
          purchase_quantity: nextIngredient.purchaseQuantity,
          purchase_uom: nextIngredient.purchaseUnit,
          purchase_cost: nextIngredient.purchaseCost,
          recipe_base_uom: nextIngredient.baseUnit,
          cost_per_base_unit: ingredientUnitCost(nextIngredient),
          default_wastage_percentage: nextIngredient.defaultWastage,
          notes: nextIngredient.notes,
          is_active: nextIngredient.active,
        })
        .eq("id", id)
        .eq("business_id", context.businessId);
      if (error) throw error;
    });
  };

  const createIngredient = () => {
    void runSupabaseMutation("Creating ingredient", "Ingredient created.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("ingredients").insert({
        business_id: context.businessId,
        name: "New Ingredient",
        purchase_quantity: 1,
        purchase_uom: "kg",
        purchase_cost: 0,
        recipe_base_uom: "kg",
        cost_per_base_unit: 0,
        default_wastage_percentage: 0,
        created_by: context.userId,
      });
      if (error) throw error;
    });
  };

  const duplicateIngredient = (ingredient: Ingredient) => {
    void runSupabaseMutation("Duplicating ingredient", "Ingredient duplicated.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("ingredients").insert({
        business_id: context.businessId,
        category_id: ingredient.categoryId ?? null,
        supplier_id: ingredient.supplierId ?? null,
        name: `${ingredient.name} copy`,
        description: ingredient.description,
        sku: ingredient.sku ? `${ingredient.sku}-COPY` : null,
        purchase_quantity: ingredient.purchaseQuantity,
        purchase_uom: ingredient.purchaseUnit,
        purchase_cost: ingredient.purchaseCost,
        recipe_base_uom: ingredient.baseUnit,
        cost_per_base_unit: ingredientUnitCost(ingredient),
        default_wastage_percentage: ingredient.defaultWastage,
        notes: ingredient.notes,
        created_by: context.userId,
      });
      if (error) throw error;
    });
  };

  const archiveIngredient = (id: string) => {
    void runSupabaseMutation("Archiving ingredient", "Ingredient archived.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("ingredients")
        .update({ is_active: false })
        .eq("id", id)
        .eq("business_id", context.businessId);
      if (error) throw error;
    });
  };

  const updateRecipe = (recipeId: string, patch: Partial<Recipe>) => {
    const currentRecipe = recipes.find((recipe) => recipe.id === recipeId);
    if (!currentRecipe) return;
    const nextRecipe = { ...currentRecipe, ...patch };
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? { ...recipe, ...patch, updatedAt: todayStamp() }
          : recipe,
      ),
    );

    void runSupabaseMutation("Saving recipe", "Recipe saved.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const recipePatch: TablesUpdate<"recipes"> = {};
      const versionPatch: TablesUpdate<"recipe_versions"> = {};

      if ("name" in patch) recipePatch.name = nextRecipe.name;
      if ("code" in patch) recipePatch.recipe_code = nextRecipe.code || null;
      if ("category" in patch) recipePatch.category = nextRecipe.category || null;
      if ("description" in patch) recipePatch.description = nextRecipe.description || null;
      if ("status" in patch) recipePatch.status = recipeStatusToDb(nextRecipe.status);
      if ("baseStartingQuantity" in patch) versionPatch.base_main_quantity = nextRecipe.baseStartingQuantity;
      if ("baseStartingUnit" in patch) versionPatch.base_main_uom = nextRecipe.baseStartingUnit;
      if ("expectedYield" in patch) versionPatch.expected_yield = nextRecipe.expectedYield;
      if ("yieldUnit" in patch) versionPatch.expected_yield_uom = nextRecipe.yieldUnit;
      if ("defaultAdditionalCost" in patch) versionPatch.estimated_additional_cost = nextRecipe.defaultAdditionalCost;
      if ("pricingMethod" in patch) versionPatch.default_pricing_method = pricingMethodToDb(nextRecipe.pricingMethod);
      if ("pricingPercentage" in patch) versionPatch.default_pricing_percentage = nextRecipe.pricingPercentage;
      if ("methodIntro" in patch) versionPatch.method_introduction = nextRecipe.methodIntro;
      if ("defaultSellingUnit" in patch) {
        const sellingUnit = sellingUnitToDb(nextRecipe.defaultSellingUnit);
        versionPatch.default_selling_unit_quantity = sellingUnit.quantity;
        versionPatch.default_selling_unit_uom = sellingUnit.uom;
      }

      if (Object.keys(recipePatch).length) {
        const { error } = await supabase
          .from("recipes")
          .update(recipePatch)
          .eq("id", recipeId)
          .eq("business_id", context.businessId);
        if (error) throw error;
      }

      if (Object.keys(versionPatch).length && currentRecipe.versionId) {
        const { error } = await supabase
          .from("recipe_versions")
          .update(versionPatch)
          .eq("id", currentRecipe.versionId);
        if (error) throw error;
      }
    });
  };

  const updateFormulaLine = (
    recipeId: string,
    lineId: string,
    patch: Partial<FormulaLine>,
  ) => {
    const currentRecipe = recipes.find((recipe) => recipe.id === recipeId);
    const currentLine = currentRecipe?.formulaLines.find((line) => line.id === lineId);
    if (!currentRecipe || !currentLine) return;
    const nextLine = { ...currentLine, ...patch };
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              updatedAt: todayStamp(),
              formulaLines: recipe.formulaLines.map((line) =>
                line.id === lineId ? { ...line, ...patch } : line,
              ),
            }
          : recipe,
      ),
    );

    void runSupabaseMutation("Saving formula line", "Formula line saved.", async () => {
      const ingredient = ingredientMap.get(nextLine.ingredientId);
      if (!ingredient) throw new Error("Select a valid ingredient.");
      const converted = convertQuantity(nextLine.quantity, nextLine.unit, ingredient.baseUnit);
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_formula_lines")
        .update({
          ingredient_id: nextLine.ingredientId,
          formula_quantity: nextLine.quantity,
          formula_uom: nextLine.unit,
          converted_base_quantity: converted,
          ingredient_cost_snapshot: ingredientUnitCost(ingredient),
          line_cost: formulaLineCost(nextLine, ingredientMap),
          is_optional: nextLine.optional,
          wastage_percentage: nextLine.wastage,
          notes: nextLine.notes,
        })
        .eq("id", lineId);
      if (error) throw error;
    });
  };

  const setMainFormulaLine = (recipeId: string, lineId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    const targetLine = recipe?.formulaLines.find((line) => line.id === lineId);
    if (!recipe || !targetLine?.recipeVersionId) return;
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              formulaLines: recipe.formulaLines.map((line) => ({
                ...line,
                isMain: line.id === lineId,
              })),
            }
          : recipe,
      ),
    );

    void runSupabaseMutation("Saving main ingredient", "Main ingredient saved.", async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase
        .from("recipe_formula_lines")
        .update({ is_main_ingredient: false })
        .eq("recipe_version_id", targetLine.recipeVersionId);
      if (resetError) throw resetError;
      const { error } = await supabase
        .from("recipe_formula_lines")
        .update({ is_main_ingredient: true })
        .eq("id", lineId);
      if (error) throw error;
    });
  };

  const addFormulaLine = (recipeId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    const ingredient = ingredients.find((item) => item.active);
    if (!recipe?.versionId || !ingredient) {
      showToast("failed", "Create an active ingredient before adding formula lines.");
      return;
    }

    void runSupabaseMutation("Adding formula line", "Formula line added.", async () => {
      const quantity = 1;
      const unit: Unit = ingredient.baseUnit;
      const line: FormulaLine = {
        id: "",
        recipeVersionId: recipe.versionId,
        ingredientId: ingredient.id,
        quantity,
        unit,
        isMain: recipe.formulaLines.length === 0,
        optional: false,
        wastage: 0,
        notes: "",
        sortOrder: recipe.formulaLines.length + 1,
      };
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_formula_lines")
        .insert({
          recipe_version_id: recipe.versionId,
          ingredient_id: ingredient.id,
          formula_quantity: quantity,
          formula_uom: unit,
          converted_base_quantity: convertQuantity(quantity, unit, ingredient.baseUnit),
          ingredient_cost_snapshot: ingredientUnitCost(ingredient),
          line_cost: formulaLineCost(line, ingredientMap),
          is_main_ingredient: line.isMain,
          is_optional: false,
          wastage_percentage: 0,
          sort_order: line.sortOrder,
        });
      if (error) throw error;
    });
  };

  const removeFormulaLine = (recipeId: string, lineId: string) => {
    void runSupabaseMutation("Deleting formula line", "Formula line deleted.", async () => {
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_formula_lines")
        .delete()
        .eq("id", lineId);
      if (error) throw error;
    });
  };

  const moveMethodStep = (recipeId: string, stepId: string, direction: -1 | 1) => {
    let reorderedSteps: MethodStep[] = [];
    setRecipes((current) =>
      current.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;
        const index = recipe.methodSteps.findIndex((step) => step.id === stepId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= recipe.methodSteps.length) {
          return recipe;
        }
        const nextSteps = [...recipe.methodSteps];
        const [step] = nextSteps.splice(index, 1);
        nextSteps.splice(nextIndex, 0, step);
        reorderedSteps = nextSteps;
        return { ...recipe, methodSteps: nextSteps };
      }),
    );

    if (reorderedSteps.length) {
      void runSupabaseMutation("Reordering method", "Method order saved.", async () => {
        const supabase = createSupabaseBrowserClient();
        for (const [index, step] of reorderedSteps.entries()) {
          const { error } = await supabase
            .from("recipe_method_steps")
            .update({ step_number: index + 1 })
            .eq("id", step.id);
          if (error) throw error;
        }
      });
    }
  };

  const updateMethodStep = (
    recipeId: string,
    stepId: string,
    patch: Partial<MethodStep>,
  ) => {
    const currentRecipe = recipes.find((recipe) => recipe.id === recipeId);
    const currentStep = currentRecipe?.methodSteps.find((step) => step.id === stepId);
    if (!currentRecipe || !currentStep) return;
    const nextStep = { ...currentStep, ...patch };
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              updatedAt: todayStamp(),
              methodSteps: recipe.methodSteps.map((step) =>
                step.id === stepId ? { ...step, ...patch } : step,
              ),
            }
          : recipe,
      ),
    );

    void runSupabaseMutation("Saving method step", "Method step saved.", async () => {
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_method_steps")
        .update({
          title: nextStep.title,
          instructions: nextStep.instructions || " ",
          equipment: nextStep.equipment || null,
          notes: nextStep.notes || null,
        })
        .eq("id", stepId);
      if (error) throw error;
    });
  };

  const addMethodStep = (recipeId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe?.versionId) return;
    void runSupabaseMutation("Adding method step", "Method step added.", async () => {
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_method_steps")
        .insert({
          recipe_version_id: recipe.versionId,
          step_number: recipe.methodSteps.length + 1,
          title: "New method step",
          instructions: "Add instructions",
        });
      if (error) throw error;
    });
  };

  const removeMethodStep = (recipeId: string, stepId: string) => {
    void runSupabaseMutation("Deleting method step", "Method step deleted.", async () => {
      const { error } = await createSupabaseBrowserClient()
        .from("recipe_method_steps")
        .delete()
        .eq("id", stepId);
      if (error) throw error;
    });
  };

  const createRecipe = () => {
    const firstIngredient = ingredients.find((ingredient) => ingredient.active);
    if (!firstIngredient) {
      showToast("failed", "Create an ingredient before creating a recipe.");
      navigate("/ingredients");
      return;
    }

    void runSupabaseMutation("Creating recipe", "Recipe created.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const recipeCode = `REC-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const { data: recipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          business_id: context.businessId,
          name: "Untitled Recipe",
          recipe_code: recipeCode,
          category: "New",
          status: "draft",
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (recipeError) throw recipeError;

      const { data: version, error: versionError } = await supabase
        .from("recipe_versions")
        .insert({
          recipe_id: recipe.id,
          version_number: 1,
          main_ingredient_id: firstIngredient.id,
          base_main_quantity: 1,
          base_main_uom: firstIngredient.baseUnit,
          expected_yield: 1,
          expected_yield_uom: firstIngredient.baseUnit,
          default_selling_unit_quantity: 1,
          default_selling_unit_uom: firstIngredient.baseUnit,
          default_pricing_method: "gross_margin",
          default_pricing_percentage: 40,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (versionError) throw versionError;

      const { error: lineError } = await supabase.from("recipe_formula_lines").insert({
        recipe_version_id: version.id,
        ingredient_id: firstIngredient.id,
        formula_quantity: 1,
        formula_uom: firstIngredient.baseUnit,
        converted_base_quantity: 1,
        ingredient_cost_snapshot: ingredientUnitCost(firstIngredient),
        line_cost: ingredientUnitCost(firstIngredient),
        is_main_ingredient: true,
        sort_order: 1,
      });
      if (lineError) throw lineError;
      setActiveRecipeId(recipe.id);
      navigate(`/recipes/${recipe.id}/edit`);
    });
  };

  const duplicateRecipe = (recipe: Recipe) => {
    void runSupabaseMutation("Duplicating recipe", "Recipe duplicated.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const { data: duplicate, error: duplicateError } = await supabase
        .from("recipes")
        .insert({
          business_id: context.businessId,
          name: `${recipe.name} copy`,
          recipe_code: recipe.code ? `${recipe.code}-COPY` : null,
          category: recipe.category,
          description: recipe.description,
          status: "draft",
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (duplicateError) throw duplicateError;

      const { data: version, error: versionError } = await supabase
        .from("recipe_versions")
        .insert({
          recipe_id: duplicate.id,
          version_number: 1,
          main_ingredient_id: recipeMainLine(recipe)?.ingredientId ?? null,
          base_main_quantity: recipe.baseStartingQuantity,
          base_main_uom: recipe.baseStartingUnit,
          expected_yield: recipe.expectedYield,
          expected_yield_uom: recipe.yieldUnit,
          estimated_additional_cost: recipe.defaultAdditionalCost,
          default_pricing_method: pricingMethodToDb(recipe.pricingMethod),
          default_pricing_percentage: recipe.pricingPercentage,
          default_selling_unit_quantity: sellingUnitToDb(recipe.defaultSellingUnit).quantity,
          default_selling_unit_uom: sellingUnitToDb(recipe.defaultSellingUnit).uom,
          method_introduction: recipe.methodIntro,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (versionError) throw versionError;

      for (const line of recipe.formulaLines) {
        const ingredient = ingredientMap.get(line.ingredientId);
        if (!ingredient) continue;
        const { error } = await supabase.from("recipe_formula_lines").insert({
          recipe_version_id: version.id,
          ingredient_id: line.ingredientId,
          formula_quantity: line.quantity,
          formula_uom: line.unit,
          converted_base_quantity: convertQuantity(line.quantity, line.unit, ingredient.baseUnit),
          ingredient_cost_snapshot: ingredientUnitCost(ingredient),
          line_cost: formulaLineCost(line, ingredientMap),
          is_main_ingredient: line.isMain,
          is_optional: line.optional,
          wastage_percentage: line.wastage,
          notes: line.notes,
          sort_order: line.sortOrder,
        });
        if (error) throw error;
      }

      for (const [index, step] of recipe.methodSteps.entries()) {
        const { error } = await supabase.from("recipe_method_steps").insert({
          recipe_version_id: version.id,
          step_number: index + 1,
          title: step.title,
          instructions: step.instructions || " ",
          equipment: step.equipment || null,
          notes: step.notes || null,
        });
        if (error) throw error;
      }
    });
  };

  const archiveRecipe = (recipeId: string) => {
    void runSupabaseMutation("Archiving recipe", "Recipe archived.", async () => {
      const context = requireBusinessContext();
      const { error } = await createSupabaseBrowserClient()
        .from("recipes")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", recipeId)
        .eq("business_id", context.businessId);
      if (error) throw error;
    });
  };

  const deleteRecipe = (recipeId: string) => {
    void runSupabaseMutation("Deleting recipe", "Recipe deleted.", async () => {
      const context = requireBusinessContext();
      const { error } = await createSupabaseBrowserClient()
        .from("recipes")
        .delete()
        .eq("id", recipeId)
        .eq("business_id", context.businessId);
      if (error) throw error;
    });
  };

  const startProduction = () => {
    if (startingProduction || !selectedProductionRecipe) return;
    setStartingProduction(true);
    void runSupabaseMutation("Starting production", "Production started.", async () => {
      const context = requireBusinessContext();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("start_production_batch", {
        p_business_id: context.businessId,
        p_location_id: context.locationId,
        p_recipe_id: selectedProductionRecipe.id,
        p_recipe_version_id: selectedProductionRecipe.versionId ?? null,
        p_actual_main_quantity: productionDraft.mainQuantity,
        p_actual_main_uom: productionDraft.mainUnit,
        p_start_datetime:
          productionDraft.startDate || new Date().toISOString(),
        p_responsible_user_id: context.userId,
        p_notes: productionDraft.notes || null,
      });
      if (error) throw error;
      if (data?.id) navigate(`/productions/${data.id}`);
    }).finally(() => setStartingProduction(false));
  };

  const updateProduction = (id: string, patch: Partial<ProductionBatch>) => {
    const currentProduction = productions.find((production) => production.id === id);
    const nextProduction = currentProduction ? { ...currentProduction, ...patch } : null;
    setProductions((current) =>
      current.map((production) =>
        production.id === id ? { ...production, ...patch } : production,
      ),
    );
    if (!nextProduction) return;

    void runSupabaseMutation("Saving production", "Production saved.", async () => {
      const dbPatch: TablesUpdate<"production_batches"> = {};
      if ("status" in patch) dbPatch.status = productionStatusToDb(nextProduction.status);
      if ("endDate" in patch) dbPatch.end_datetime = nextProduction.endDate || null;
      if ("startingYield" in patch) dbPatch.starting_yield = nextProduction.startingYield;
      if ("completedYield" in patch) dbPatch.completed_yield = nextProduction.completedYield;
      if ("yieldUnit" in patch) dbPatch.completed_yield_uom = nextProduction.yieldUnit;
      if ("completedBy" in patch) dbPatch.completed_by = currentUser?.id ?? null;
      if ("qualityRating" in patch) dbPatch.quality_rating = nextProduction.qualityRating ? Number(nextProduction.qualityRating) : null;
      if ("outcomeNotes" in patch) dbPatch.outcome_notes = nextProduction.outcomeNotes || null;
      if (!Object.keys(dbPatch).length) return;
      const { error } = await createSupabaseBrowserClient()
        .from("production_batches")
        .update(dbPatch)
        .eq("id", id);
      if (error) throw error;
    });
  };

  const updateProductionLine = (
    productionId: string,
    lineId: string,
    patch: Partial<ProductionLine>,
  ) => {
    const currentProduction = productions.find((production) => production.id === productionId);
    const currentLine = currentProduction?.lines.find((line) => line.id === lineId);
    const nextLine = currentLine ? { ...currentLine, ...patch } : null;
    setProductions((current) =>
      current.map((production) =>
        production.id === productionId
          ? {
              ...production,
              lines: production.lines.map((line) => {
                if (line.id !== lineId) return line;
                const nextLine = { ...line, ...patch };
                const ingredient = ingredientMap.get(nextLine.ingredientId);
                const actualQuantityInBaseUnit = ingredient
                  ? convertQuantity(
                      nextLine.actualQuantity,
                      nextLine.actualUnit,
                      ingredient.baseUnit,
                    )
                  : nextLine.actualQuantity;
                return {
                  ...nextLine,
                  actualCost: actualQuantityInBaseUnit * nextLine.costSnapshot,
                };
              }),
            }
          : production,
      ),
    );
    if (!nextLine) return;
    void runSupabaseMutation("Saving production line", "Production line saved.", async () => {
      const { error } = await createSupabaseBrowserClient()
        .from("production_ingredient_lines")
        .update({
          actual_quantity: nextLine.actualQuantity,
          actual_uom: nextLine.actualUnit,
          actual_line_cost: nextLine.actualCost,
          quantity_variance: nextLine.actualQuantity - nextLine.requiredQuantity,
          cost_variance: nextLine.actualCost - nextLine.expectedCost,
          notes: nextLine.notes,
        })
        .eq("id", lineId)
        .eq("production_batch_id", productionId);
      if (error) throw error;
    });
  };

  const completeProduction = (production: ProductionBatch) => {
    if (
      !production.endDate ||
      !production.completedBy ||
      production.startingYield <= 0 ||
      production.completedYield <= 0
    ) {
      showToast("failed", "Enter completion date, yields and completed by.");
      return;
    }

    void runSupabaseMutation("Completing production", "Production completed.", async () => {
      const { error } = await createSupabaseBrowserClient().rpc(
        "complete_production_batch",
        {
          p_production_batch_id: production.id,
          p_end_datetime: production.endDate,
          p_starting_yield: production.startingYield,
          p_completed_yield: production.completedYield,
          p_completed_yield_uom: production.yieldUnit,
          p_completed_by: currentUser?.id ?? null,
          p_quality_rating: production.qualityRating
            ? Number(production.qualityRating)
            : null,
          p_outcome_notes: production.outcomeNotes || null,
        },
      );
      if (error) throw error;
      navigate("/productions/completed");
    });
  };

  const pageTitle = pageTitleForPath(pathname);
  const toastRegion = (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div className={`toast ${toast.kind}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {toast.kind === "success" ? "+" : toast.kind === "info" ? "i" : "!"}
          </span>
          <span>
            <strong>
              {toast.kind === "success"
                ? "Successful"
                : toast.kind === "failed"
                  ? "Failed"
                  : toast.kind === "warning"
                    ? "Attention"
                    : "Notice"}
            </strong>
            <small>{toast.message}</small>
          </span>
        </div>
      ) : null}
    </div>
  );

  if (pathname === "/") {
    return (
      <main className="public-home-shell">
        {toastRegion}
        {renderPublicHome()}
      </main>
    );
  }

  return (
    <main className="app-shell">
      {toastRegion}

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Recipe Cost Calculator</p>
            <h1>{pageTitle.title}</h1>
            <p>{pageTitle.description}</p>
          </div>
          <div className="topbar-actions" aria-label="Primary actions">
            {mutationLabel ? <span className="muted-cell">{mutationLabel}...</span> : null}
            {currentUser ? (
              <button type="button" className="ghost-button" onClick={signOut}>
                Sign out
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              disabled={supabaseState !== "ready" || Boolean(mutationLabel)}
              onClick={() => navigate("/productions/new")}
            >
              New Production
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={supabaseState !== "ready" || Boolean(mutationLabel)}
              onClick={createRecipe}
            >
              New Recipe
            </button>
          </div>
        </header>

        {supabaseState !== "ready"
          ? renderSupabaseGate()
          : isDataLoading
            ? renderLoadingPanel()
            : pathname === "/" || pathname === "/dashboard"
              ? renderDashboard()
              : pathname === "/ingredients"
                ? renderIngredientsList()
                : pathname === "/recipes"
                  ? renderRecipesList()
                  : pathname === "/recipes/new" ||
                      /^\/recipes\/[^/]+(\/edit)?$/.test(pathname)
                    ? renderRecipeWorkspace()
                    : pathname === "/productions" || pathname === "/productions/"
                      ? renderProductionsSummary()
                      : pathname === "/productions/new"
                        ? renderNewProduction()
                        : pathname === "/productions/in-progress"
                          ? renderInProgress()
                          : pathname === "/productions/completed"
                            ? renderCompletedProductions()
                            : /^\/productions\/[^/]+$/.test(pathname)
                              ? renderProductionDetail()
                              : pathname === "/reports"
                                ? renderReports()
                                : renderSettings()}
      </section>

      <aside className="sidebar" aria-label="Primary application navigation">
        <div className="brand-block">
          <span className="brand-mark">RC</span>
          <span>
            <strong>Recipe Cost</strong>
            <small>Operations</small>
          </span>
        </div>
        <nav>
          {[
            ["D", "Dashboard", "/dashboard"],
            ["I", "Ingredients List", "/ingredients"],
            ["R", "Recipes", "/recipes"],
            ["P", "Productions", "/productions"],
            ["A", "Reports", "/reports"],
            ["S", "Settings", "/settings"],
          ].map(([icon, label, href]) => (
            <a
              key={href}
              href={href}
              className={isActiveNav(pathname, href) ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                navigate(href);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          ["Home", "/dashboard"],
          ["Ingredients", "/ingredients"],
          ["Recipes", "/recipes"],
          ["Productions", "/productions"],
          ["More", "/reports"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className={isActiveNav(pathname, href) ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              navigate(href);
            }}
          >
            {label}
          </a>
        ))}
      </nav>
    </main>
  );

  function renderPublicHome() {
    return (
      <section className="home-auth-layout">
        <section className="home-product-panel" aria-label="Product overview">
          <p className="eyebrow">Production Controller</p>
          <h1>Production Controller</h1>
          <p>
            Create production formulas, scale ingredient quantities, track active
            production batches, calculate completed yields and determine accurate
            production costs and selling prices.
          </p>
          <div className="home-feature-grid">
            <div><strong>Formula control</strong><span>Recipe versions, units and costs.</span></div>
            <div><strong>Production tracking</strong><span>Active batches and completion snapshots.</span></div>
            <div><strong>Cost accuracy</strong><span>Ingredient, yield and selling price calculations.</span></div>
          </div>
        </section>

        <section className="auth-panel" aria-label="Authentication">
          <div className="auth-panel-heading">
            <span className="brand-mark">PC</span>
            <div>
              <h2>
                {homeAuthMode === "register"
                  ? "Create account"
                  : homeAuthMode === "forgot"
                    ? "Reset password"
                    : homeAuthMode === "verify"
                      ? "Verify your email"
                      : "Login"}
              </h2>
              <p>
                {homeAuthMode === "register"
                  ? "Set up your user account and first business."
                  : homeAuthMode === "forgot"
                    ? "We will send reset instructions if the email exists."
                    : homeAuthMode === "verify"
                      ? "Open the link in your email to complete registration."
                      : "Sign in to open your protected dashboard."}
              </p>
            </div>
          </div>

          {homeAuthMode !== "verify" ? (
            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={homeAuthMode === "login" ? "active" : ""}
                onClick={() => setHomeAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={homeAuthMode === "register" ? "active" : ""}
                onClick={() => setHomeAuthMode("register")}
              >
                Register
              </button>
            </div>
          ) : null}

          {homeAuthMode === "login"
            ? renderLoginPanel()
            : homeAuthMode === "forgot"
              ? renderForgotPasswordPanel()
              : homeAuthMode === "verify"
                ? renderVerificationPanel()
                : renderRegistrationPanel()}
        </section>
      </section>
    );
  }

  function renderLoginPanel() {
    return (
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitLogin();
        }}
      >
        <Field label="Email address" required>
          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </Field>
        <Field label="Password" required>
          <span className="password-control">
            <input
              type={showLoginPassword ? "text" : "password"}
              autoComplete="current-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
            <button
              type="button"
              className="compact-button"
              onClick={() => setShowLoginPassword((current) => !current)}
            >
              {showLoginPassword ? "Hide" : "Show"}
            </button>
          </span>
        </Field>
        <div className="auth-row">
          <label className="check-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
          <button
            type="button"
            className="link-button"
            onClick={() => setHomeAuthMode("forgot")}
          >
            Forgot password
          </button>
        </div>
        <button
          type="submit"
          className="primary-button block-action"
          disabled={authSubmitting}
        >
          {authSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>
    );
  }

  function renderForgotPasswordPanel() {
    return (
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitForgotPassword();
        }}
      >
        <Field label="Email address" required>
          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </Field>
        <button
          type="submit"
          className="primary-button block-action"
          disabled={authSubmitting}
        >
          {authSubmitting ? "Sending..." : "Send Reset Email"}
        </button>
        <button
          type="button"
          className="ghost-button block-action"
          onClick={() => setHomeAuthMode("login")}
        >
          Back to Login
        </button>
      </form>
    );
  }

  function renderVerificationPanel() {
    return (
      <div className="auth-form">
        <div className="verification-note">
          <strong>Verify your email</strong>
          <span>
            We sent a verification link to {verificationEmail || "your email address"}.
            Open the link to complete your registration.
          </span>
        </div>
        <button
          type="button"
          className="primary-button block-action"
          disabled={authSubmitting}
          onClick={resendVerificationEmail}
        >
          {authSubmitting ? "Sending..." : "Resend Verification Email"}
        </button>
        <button
          type="button"
          className="ghost-button block-action"
          onClick={() => setHomeAuthMode("login")}
        >
          Back to Login
        </button>
      </div>
    );
  }

  function renderRegistrationPanel() {
    const selectedCountry = countryByCode(registrationDraft.countryCode);
    return (
      <div className="auth-form">
        <div className="registration-progress" aria-label="Registration progress">
          <span className={registrationStep === "user" ? "active" : ""}>User Details</span>
          <span aria-hidden="true">-&gt;</span>
          <span className={registrationStep === "business" ? "active" : ""}>Business Details</span>
          <span aria-hidden="true">-&gt;</span>
          <span className={registrationStep === "review" ? "active" : ""}>Review</span>
        </div>

        {registrationStep === "user" ? renderRegistrationUserStep() : null}
        {registrationStep === "business" ? renderRegistrationBusinessStep() : null}
        {registrationStep === "review" ? renderRegistrationReview(selectedCountry) : null}
      </div>
    );
  }

  function renderRegistrationUserStep() {
    const passwordErrors = passwordStrengthErrors(registrationDraft.password);
    return (
      <>
        <div className="form-grid two">
          <Field label="First Name" required>
            <input
              value={registrationDraft.firstName}
              onChange={(event) => updateRegistrationDraft({ firstName: event.target.value })}
            />
          </Field>
          <Field label="Last Name" required>
            <input
              value={registrationDraft.lastName}
              onChange={(event) => updateRegistrationDraft({ lastName: event.target.value })}
            />
          </Field>
          <Field label="Email Address" required>
            <input
              type="email"
              autoComplete="email"
              value={registrationDraft.email}
              onChange={(event) => updateRegistrationDraft({ email: event.target.value })}
            />
          </Field>
          <Field label="Contact Number" required>
            <input
              type="tel"
              autoComplete="tel"
              value={registrationDraft.contactNumber}
              onChange={(event) =>
                updateRegistrationDraft({ contactNumber: event.target.value })
              }
              placeholder="+27 82 000 0000"
            />
          </Field>
        </div>
        <Field label="Password" required>
          <span className="password-control">
            <input
              type={showRegistrationPassword ? "text" : "password"}
              autoComplete="new-password"
              value={registrationDraft.password}
              onChange={(event) =>
                updateRegistrationDraft({ password: event.target.value })
              }
            />
            <button
              type="button"
              className="compact-button"
              onClick={() => setShowRegistrationPassword((current) => !current)}
            >
              {showRegistrationPassword ? "Hide" : "Show"}
            </button>
          </span>
        </Field>
        <Field label="Confirm Password" required>
          <input
            type={showRegistrationPassword ? "text" : "password"}
            autoComplete="new-password"
            value={registrationDraft.confirmPassword}
            onChange={(event) =>
              updateRegistrationDraft({ confirmPassword: event.target.value })
            }
          />
        </Field>
        <div className="password-hints">
          {(passwordErrors.length ? passwordErrors : ["Password strength requirements met."]).map(
            (hint) => (
              <span key={hint}>{hint}</span>
            ),
          )}
        </div>
        <button type="button" className="primary-button block-action" onClick={advanceRegistration}>
          Continue
        </button>
      </>
    );
  }

  function renderRegistrationBusinessStep() {
    return (
      <>
        <Field label="Business Name" required>
          <input
            value={registrationDraft.businessName}
            onChange={(event) =>
              updateRegistrationDraft({ businessName: event.target.value })
            }
          />
        </Field>
        <div className="form-grid two">
          <Field label="Address Line 1">
            <input
              value={registrationDraft.addressLine1}
              onChange={(event) =>
                updateRegistrationDraft({ addressLine1: event.target.value })
              }
            />
          </Field>
          <Field label="Address Line 2">
            <input
              value={registrationDraft.addressLine2}
              onChange={(event) =>
                updateRegistrationDraft({ addressLine2: event.target.value })
              }
            />
          </Field>
          <Field label="City or Town">
            <input
              value={registrationDraft.city}
              onChange={(event) => updateRegistrationDraft({ city: event.target.value })}
            />
          </Field>
          <Field label="Province, State or Region">
            <input
              value={registrationDraft.provinceRegion}
              onChange={(event) =>
                updateRegistrationDraft({ provinceRegion: event.target.value })
              }
            />
          </Field>
          <Field label="Postal Code">
            <input
              value={registrationDraft.postalCode}
              onChange={(event) =>
                updateRegistrationDraft({ postalCode: event.target.value })
              }
            />
          </Field>
          <Field label="Country" required>
            <input
              list="country-options"
              value={countrySearch}
              onChange={(event) => handleCountrySelection(event.target.value)}
            />
          </Field>
        </div>
        <datalist id="country-options">
          {countryCurrencyOptions.map((country) => (
            <option key={country.countryCode} value={countryInputLabel(country)} />
          ))}
        </datalist>
        <Field label="Currency" required>
          <select
            value={registrationDraft.currencyCode}
            onChange={(event) => {
              const option = countryCurrencyOptions.find(
                (country) => country.defaultCurrencyCode === event.target.value,
              );
              updateRegistrationDraft({
                currencyCode: event.target.value,
                currencySymbol: option?.currencySymbol ?? registrationDraft.currencySymbol,
              });
            }}
          >
            {Array.from(
              new Map(
                countryCurrencyOptions.map((country) => [
                  country.defaultCurrencyCode,
                  country,
                ]),
              ).values(),
            ).map((country) => (
              <option key={country.defaultCurrencyCode} value={country.defaultCurrencyCode}>
                {currencyDisplay(country)}
              </option>
            ))}
          </select>
        </Field>
        <div className="auth-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setRegistrationStep("user")}
          >
            Back
          </button>
          <button type="button" className="primary-button" onClick={advanceRegistration}>
            Review
          </button>
        </div>
      </>
    );
  }

  function renderRegistrationReview(selectedCountry: ReturnType<typeof countryByCode>) {
    const selectedCurrency =
      countryCurrencyOptions.find(
        (country) =>
          country.defaultCurrencyCode === registrationDraft.currencyCode,
      ) ?? selectedCountry;
    const address = [
      registrationDraft.addressLine1,
      registrationDraft.addressLine2,
      registrationDraft.city,
      registrationDraft.provinceRegion,
      registrationDraft.postalCode,
      selectedCountry.countryName,
    ]
      .filter(Boolean)
      .join(", ");
    return (
      <>
        <div className="registration-review">
          <div>
            <span>User</span>
            <strong>
              {registrationDraft.firstName.trim()} {registrationDraft.lastName.trim()}
            </strong>
            <small>{registrationDraft.email.trim().toLowerCase()}</small>
            <small>{normalizePhone(registrationDraft.contactNumber)}</small>
          </div>
          <div>
            <span>Business</span>
            <strong>{registrationDraft.businessName.trim()}</strong>
            <small>{address || selectedCountry.countryName}</small>
            <small>{currencyDisplay(selectedCurrency)}</small>
          </div>
        </div>
        <label className="check-row confirm-row">
          <input
            type="checkbox"
            checked={registrationDraft.confirmInformation}
            onChange={(event) =>
              updateRegistrationDraft({ confirmInformation: event.target.checked })
            }
          />
          I confirm that the information provided is correct.
        </label>
        <p className="terms-line">
          By creating an account you agree to the <a href="#">Terms of Service</a>{" "}
          and <a href="#">Privacy Policy</a>.
        </p>
        <div className="auth-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setRegistrationStep("business")}
          >
            Back
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={authSubmitting}
            onClick={submitRegistration}
          >
            {authSubmitting ? "Creating..." : "Create Account"}
          </button>
        </div>
      </>
    );
  }

  function renderSupabaseGate() {
    const copy =
      supabaseState === "checking"
        ? "Connecting to Supabase and checking your session."
        : supabaseState === "no-business"
          ? "Your account is signed in, but it is not linked to an active business yet."
          : supabaseState === "failed"
            ? "Supabase could not be reached. Check the environment configuration and connection."
            : "Login from the public Home page to load ingredients, recipes, productions and costing records.";

    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Supabase backend</h2>
              <p>{copy}</p>
            </div>
          </div>
          {supabaseState === "unauthenticated" ? (
            <button type="button" className="primary-button" onClick={() => navigate("/")}>
              Go to Login
            </button>
          ) : null}
          {supabaseState === "failed" || supabaseState === "no-business" ? (
            <button type="button" className="compact-button" onClick={() => void loadSupabaseData()}>
              Retry
            </button>
          ) : null}
        </section>
      </section>
    );
  }

  function renderLoadingPanel() {
    return (
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Loading Supabase records</h2>
            <p>Fetching business-scoped ingredients, recipes and productions.</p>
          </div>
        </div>
        <div className="sheet-empty">Loading rows...</div>
      </section>
    );
  }

  function renderDashboard() {
    const draftRecipes = recipes.filter((recipe) => recipe.status === "Draft").length;
    const ingredientValue = ingredients.reduce(
      (sum, ingredient) => sum + ingredient.purchaseCost,
      0,
    );
    return (
      <section className="page-stack">
        <div className="metric-grid dashboard-metrics">
          <div>
            <span>Active ingredients</span>
            <strong>{ingredients.filter((ingredient) => ingredient.active).length}</strong>
          </div>
          <div>
            <span>Saved recipes</span>
            <strong>{recipes.length}</strong>
          </div>
          <div>
            <span>In progress</span>
            <strong>{activeProductions.length}</strong>
          </div>
          <div>
            <span>Completed batches</span>
            <strong>{completedProductions.length}</strong>
          </div>
        </div>
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Current activity</h2>
              <p>Compact summary without loading every operational page.</p>
            </div>
          </div>
          <div className="summary-grid">
            <div className="summary-cell">
              <span>Draft recipes</span>
              <strong>{draftRecipes}</strong>
              <small>Open Recipes to continue editing formulas.</small>
            </div>
            <div className="summary-cell">
              <span>Ingredient purchase value</span>
              <strong>{formatMoney(ingredientValue)}</strong>
              <small>Current library purchase-cost basis.</small>
            </div>
            <div className="summary-cell">
              <span>Next action</span>
              <strong>Start production</strong>
              <small>Choose a saved recipe and confirm the method snapshot.</small>
            </div>
          </div>
        </section>
      </section>
    );
  }

  function renderIngredientsList() {
    const categories = [
      "All",
      ...Array.from(
        new Set([
          ...ingredientCategories.map((item) => item.name),
          ...ingredients.map((item) => item.category).filter(Boolean),
        ]),
      ),
    ];
    const suppliers = [
      "All",
      ...Array.from(
        new Set([
          ...ingredientSuppliers.map((item) => item.name),
          ...ingredients.map((item) => item.supplier).filter(Boolean),
        ]),
      ),
    ];
    const hasImportErrors = importRows.some((row) =>
      ["Duplicate", "Invalid", "Skipped"].includes(row.result),
    );
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Ingredients List</h2>
              <p>Maintain ingredients, purchase costs, suppliers and recipe units.</p>
            </div>
            <div className="ingredient-header-actions">
              <button type="button" className="compact-button" onClick={openIngredientImportDialog}>
                Import
              </button>
              <div className="action-menu-wrap">
                <button
                  type="button"
                  className="compact-button"
                  aria-expanded={exportMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setExportMenuOpen((current) => !current)}
                >
                  Export
                </button>
                {exportMenuOpen ? (
                  <div className="compact-menu" role="menu">
                    <button type="button" role="menuitem" onClick={downloadCurrentIngredientsXlsx}>
                      Export Current Ingredient List as XLSX
                    </button>
                    <button type="button" role="menuitem" onClick={downloadCurrentIngredientsCsv}>
                      Export Current Ingredient List as CSV
                    </button>
                    <button type="button" role="menuitem" onClick={downloadIngredientTemplateXlsx}>
                      Download XLSX Import Template
                    </button>
                    <button type="button" role="menuitem" onClick={downloadIngredientTemplateCsv}>
                      Download CSV Import Template
                    </button>
                  </div>
                ) : null}
              </div>
              <button type="button" className="primary-button" onClick={createIngredient}>
                + Ingredient
              </button>
            </div>
          </div>
          <div className="filter-bar">
            <input
              aria-label="Search ingredients"
              placeholder="Search ingredient or SKU"
              value={ingredientSearch}
              onChange={(event) => setIngredientSearch(event.target.value)}
            />
            <select
              aria-label="Category filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <select
              aria-label="Supplier filter"
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
            >
              {suppliers.map((supplier) => (
                <option key={supplier}>{supplier}</option>
              ))}
            </select>
            <select
              aria-label="Active status filter"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
          <div className="sheet ingredient-list-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Ingredient</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Supplier</span>
              <span role="columnheader">SKU</span>
              <span role="columnheader">Purchase</span>
              <span role="columnheader">Cost</span>
              <span role="columnheader">Base</span>
              <span role="columnheader">Cost/base</span>
              <span role="columnheader">Waste %</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actions</span>
            </div>
            {filteredIngredients.map((ingredient) => (
              <div className="sheet-row" role="row" key={ingredient.id}>
                <span role="cell">
                  <input
                    value={ingredient.name}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { name: event.target.value })
                    }
                    aria-label={`Ingredient name ${ingredient.name}`}
                  />
                </span>
                <span role="cell">
                  <input
                    value={ingredient.category}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { category: event.target.value })
                    }
                    aria-label={`Category ${ingredient.name}`}
                  />
                </span>
                <span role="cell">
                  <input
                    value={ingredient.supplier}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { supplier: event.target.value })
                    }
                    aria-label={`Supplier ${ingredient.name}`}
                  />
                </span>
                <span role="cell">
                  <input
                    value={ingredient.sku}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { sku: event.target.value })
                    }
                    aria-label={`SKU ${ingredient.name}`}
                  />
                </span>
                <span role="cell" className="quantity-pair">
                  <NumberInput
                    label={`Purchase quantity ${ingredient.name}`}
                    value={ingredient.purchaseQuantity}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, { purchaseQuantity: value })
                    }
                  />
                  <UnitSelect
                    label={`Purchase unit ${ingredient.name}`}
                    value={ingredient.purchaseUnit}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, { purchaseUnit: value })
                    }
                  />
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Purchase cost ${ingredient.name}`}
                    value={ingredient.purchaseCost}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, {
                        purchaseCost: value,
                        lastCostUpdate: "23 Jul 2026",
                      })
                    }
                  />
                </span>
                <span role="cell">
                  <UnitSelect
                    label={`Recipe base unit ${ingredient.name}`}
                    value={ingredient.baseUnit}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, { baseUnit: value })
                    }
                  />
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatMoney(ingredientUnitCost(ingredient), 4)}
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Default wastage ${ingredient.name}`}
                    value={ingredient.defaultWastage}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, { defaultWastage: value })
                    }
                  />
                </span>
                <span role="cell">
                  <strong className={`status-chip ${ingredient.active ? "" : "muted-status"}`}>
                    {ingredient.active ? "Active" : "Inactive"}
                  </strong>
                </span>
                <span role="cell" className="action-cell">
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit"
                    aria-label={`Edit ${ingredient.name}`}
                    onClick={() => showToast("info", `${ingredient.name} is editable inline.`)}
                  >
                    E
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Duplicate"
                    aria-label={`Duplicate ${ingredient.name}`}
                    onClick={() => duplicateIngredient(ingredient)}
                  >
                    D
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Archive"
                    aria-label={`Archive ${ingredient.name}`}
                    onClick={() => archiveIngredient(ingredient.id)}
                  >
                    A
                  </button>
                </span>
              </div>
            ))}
            {filteredIngredients.length === 0 ? (
              <div className="sheet-empty ingredients-empty-state">
                <strong>No ingredients found.</strong>
                <span>
                  Add your first ingredient manually or import an ingredient list using the XLSX
                  or CSV template.
                </span>
                <div className="empty-actions">
                  <button type="button" className="primary-button" onClick={createIngredient}>
                    + Ingredient
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={openIngredientImportDialog}
                  >
                    Import Ingredients
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={downloadIngredientTemplateXlsx}
                  >
                    Download Template
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mobile-records">
            {filteredIngredients.map((ingredient) => (
              <details className="sheet-record" key={ingredient.id}>
                <summary>
                  <span>
                    <strong>{ingredient.name}</strong>
                    <small>{ingredient.supplier} / {ingredient.sku}</small>
                  </span>
                  <span>{formatMoney(ingredientUnitCost(ingredient), 4)}</span>
                </summary>
                <div className="record-grid">
                  <div className="record-metric">
                    <span>Purchase</span>
                    <strong>
                      {formatNumber(ingredient.purchaseQuantity, 2)}{" "}
                      {ingredient.purchaseUnit}
                    </strong>
                  </div>
                  <div className="record-metric">
                    <span>Base unit</span>
                    <strong>{ingredient.baseUnit}</strong>
                  </div>
                  <div className="record-metric">
                    <span>Last cost update</span>
                    <strong>{ingredient.lastCostUpdate}</strong>
                  </div>
                  <div className="record-actions">
                    <button
                      type="button"
                      className="compact-button"
                      onClick={() => duplicateIngredient(ingredient)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="compact-button delete-button"
                      onClick={() => archiveIngredient(ingredient.id)}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </details>
            ))}
            {filteredIngredients.length === 0 ? (
              <div className="sheet-record empty-record">
                <strong>No ingredients found.</strong>
                <p>
                  Add your first ingredient manually or import an ingredient list using the XLSX
                  or CSV template.
                </p>
                <div className="record-actions">
                  <button type="button" className="primary-button" onClick={createIngredient}>
                    + Ingredient
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={openIngredientImportDialog}
                  >
                    Import Ingredients
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={downloadIngredientTemplateXlsx}
                  >
                    Download Template
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
        {importDialogOpen ? renderIngredientImportDialog(hasImportErrors) : null}
      </section>
    );
  }

  function renderIngredientImportDialog(hasImportErrors: boolean) {
    const summary = ingredientImportSummary(importRows);
    const readyCount = summary.readyToAdd + summary.readyToUpdate;
    return (
      <div className="dialog-backdrop" role="presentation">
        <section
          className="import-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingredient-import-title"
        >
          <div className="section-title">
            <div>
              <h2 id="ingredient-import-title">Import Ingredients</h2>
              <p>Validate the complete file, preview rows, then save the valid records.</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close import dialog"
              onClick={() => setImportDialogOpen(false)}
            >
              X
            </button>
          </div>

          <div className="import-toolbar">
            <label className="compact-file-input">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleIngredientFileChange}
              />
              <span>{importFileName || "Choose CSV or XLSX"}</span>
            </label>
            <button type="button" className="compact-button" onClick={downloadIngredientTemplateXlsx}>
              XLSX Template
            </button>
            <button type="button" className="compact-button" onClick={downloadIngredientTemplateCsv}>
              CSV Template
            </button>
          </div>

          <div className="form-grid two import-settings">
            <Field label="Import mode">
              <select
                value={importMode}
                onChange={(event) =>
                  setImportMode(event.target.value as IngredientImportMode)
                }
              >
                <option value="add-only">Add New Only</option>
                <option value="add-update">Add New and Update Existing</option>
              </select>
            </Field>
            <Field label="Category and supplier handling">
              <select
                value={missingLookupMode}
                onChange={(event) =>
                  setMissingLookupMode(event.target.value as MissingLookupMode)
                }
              >
                <option value="create">Create missing categories and suppliers</option>
                <option value="reject">Reject rows with missing categories or suppliers</option>
              </select>
            </Field>
          </div>

          <div className="import-summary" aria-label="Import summary">
            <span>Total rows <strong>{summary.totalRows}</strong></span>
            <span>Ready to add <strong>{summary.readyToAdd}</strong></span>
            <span>Ready to update <strong>{summary.readyToUpdate}</strong></span>
            <span>Duplicates <strong>{summary.duplicates}</strong></span>
            <span>Invalid rows <strong>{summary.invalidRows}</strong></span>
          </div>

          <div className="sheet import-preview-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Row</span>
              <span role="columnheader">Ingredient Name</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Supplier</span>
              <span role="columnheader">SKU</span>
              <span role="columnheader">Purchase Qty</span>
              <span role="columnheader">Purchase UOM</span>
              <span role="columnheader">Purchase Cost</span>
              <span role="columnheader">Base UOM</span>
              <span role="columnheader">Cost/Base</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Import Result</span>
              <span role="columnheader">Validation Message</span>
            </div>
            {importRows.map((row) => (
              <div className="sheet-row" role="row" key={`${row.rowNumber}-${row.name}`}>
                <span role="cell">{row.rowNumber}</span>
                <span role="cell"><strong>{row.name || "Unnamed"}</strong></span>
                <span role="cell">{row.category || "Unassigned"}</span>
                <span role="cell">{row.supplier || "Unassigned"}</span>
                <span role="cell" className="muted-cell">{row.sku || "-"}</span>
                <span role="cell" className="numeric-cell">{formatNumber(row.purchaseQuantity, 3)}</span>
                <span role="cell">{row.purchaseUnit || "-"}</span>
                <span role="cell" className="numeric-cell">{formatMoney(row.purchaseCost)}</span>
                <span role="cell">{row.baseUnit || "-"}</span>
                <span role="cell" className="numeric-cell">{formatMoney(row.costPerBaseUnit, 4)}</span>
                <span role="cell">{row.active ? "Active" : "Inactive"}</span>
                <span role="cell"><strong className={`status-chip import-result-${row.result.toLowerCase().replaceAll(" ", "-")}`}>{row.result}</strong></span>
                <span role="cell" className="muted-cell">{row.message}</span>
              </div>
            ))}
            {importRows.length === 0 ? (
              <div className="sheet-empty">
                Select a CSV or XLSX ingredient file to validate and preview rows.
              </div>
            ) : null}
          </div>

          <div className="mobile-records import-mobile-records">
            {importRows.map((row) => (
              <details className="sheet-record" key={`mobile-${row.rowNumber}-${row.name}`}>
                <summary>
                  <span>
                    <strong>Row {row.rowNumber}: {row.name || "Unnamed"}</strong>
                    <small>{row.result}</small>
                  </span>
                  <span>{formatMoney(row.costPerBaseUnit, 4)}</span>
                </summary>
                <div className="record-grid">
                  <div className="record-metric"><span>Category</span><strong>{row.category || "Unassigned"}</strong></div>
                  <div className="record-metric"><span>Supplier</span><strong>{row.supplier || "Unassigned"}</strong></div>
                  <div className="record-metric"><span>Purchase</span><strong>{formatNumber(row.purchaseQuantity, 3)} {row.purchaseUnit}</strong></div>
                  <div className="record-metric"><span>Status</span><strong>{row.active ? "Active" : "Inactive"}</strong></div>
                  <div className="record-metric full-record-field"><span>Validation</span><strong>{row.message}</strong></div>
                </div>
              </details>
            ))}
          </div>

          <div className="import-dialog-footer">
            <div className="dialog-secondary-actions">
              {hasImportErrors ? (
                <>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={exportIngredientErrorReportXlsx}
                  >
                    Error XLSX
                  </button>
                  <button
                    type="button"
                    className="compact-button"
                    onClick={exportIngredientErrorReportCsv}
                  >
                    Error CSV
                  </button>
                </>
              ) : null}
              <button type="button" className="compact-button" onClick={clearIngredientImport}>
                Clear
              </button>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={importProcessing || readyCount === 0}
              onClick={confirmIngredientImport}
            >
              {importProcessing ? "Importing..." : `Confirm Import (${readyCount})`}
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderRecipesList() {
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Recipes</h2>
              <p>Create and manage production formulas separate from ingredients.</p>
            </div>
            <button type="button" className="compact-button" onClick={createRecipe}>
              + Recipe
            </button>
          </div>
          <div className="sheet recipes-list-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Recipe</span>
              <span role="columnheader">Code</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Main</span>
              <span role="columnheader">Base qty</span>
              <span role="columnheader">Yield</span>
              <span role="columnheader">Base cost</span>
              <span role="columnheader">Cost/yield</span>
              <span role="columnheader">Version</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Updated</span>
              <span role="columnheader">Actions</span>
            </div>
            {recipeRows.map((recipe) => {
              const mainLine = recipeMainLine(recipe);
              return (
                <div className="sheet-row" role="row" key={recipe.id}>
                  <span role="cell"><strong>{recipe.name}</strong></span>
                  <span role="cell" className="muted-cell">{recipe.code}</span>
                  <span role="cell" className="muted-cell">{recipe.category}</span>
                  <span role="cell" className="muted-cell">{recipe.mainIngredient}</span>
                  <span role="cell" className="numeric-cell">
                    {formatNumber(mainLine?.quantity ?? 0, 3)} {mainLine?.unit}
                  </span>
                  <span role="cell" className="numeric-cell">
                    {formatNumber(recipe.expectedYield, 3)} {recipe.yieldUnit}
                  </span>
                  <span role="cell" className="numeric-cell strong-cell">
                    {formatMoney(recipe.formulaCost)}
                  </span>
                  <span role="cell" className="numeric-cell">
                    {formatMoney(recipe.costPerYield)}
                  </span>
                  <span role="cell">v{recipe.version}</span>
                  <span role="cell"><strong className="status-chip muted-status">{recipe.status}</strong></span>
                  <span role="cell" className="muted-cell">{recipe.updatedAt}</span>
                  <span role="cell" className="action-cell wide-actions">
                    <button type="button" className="compact-button" onClick={() => navigate(`/recipes/${recipe.id}`)}>View</button>
                    <button type="button" className="compact-button" onClick={() => { setActiveRecipeId(recipe.id); navigate(`/recipes/${recipe.id}/edit`); }}>Edit</button>
                    <button type="button" className="compact-button" onClick={() => duplicateRecipe(recipe)}>Duplicate</button>
                    <button type="button" className="compact-button" onClick={() => { setProductionDraft((current) => ({ ...current, recipeId: recipe.id })); navigate(`/productions/new?recipeId=${recipe.id}`); }}>Create Production</button>
                    <button type="button" className="compact-button delete-button" onClick={() => archiveRecipe(recipe.id)}>Archive</button>
                    <button type="button" className="compact-button delete-button" onClick={() => deleteRecipe(recipe.id)}>Delete</button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mobile-records">
            {recipeRows.map((recipe) => (
              <details className="sheet-record" key={recipe.id}>
                <summary>
                  <span>
                    <strong>{recipe.name}</strong>
                    <small>{recipe.code} / {recipe.mainIngredient}</small>
                  </span>
                  <span>{formatMoney(recipe.costPerYield)}</span>
                </summary>
                <div className="record-grid">
                  <div className="record-metric"><span>Yield</span><strong>{formatNumber(recipe.expectedYield, 3)} {recipe.yieldUnit}</strong></div>
                  <div className="record-metric"><span>Version</span><strong>v{recipe.version}</strong></div>
                  <div className="record-actions">
                    <button type="button" className="compact-button" onClick={() => navigate(`/recipes/${recipe.id}`)}>View</button>
                    <button type="button" className="compact-button" onClick={() => { setActiveRecipeId(recipe.id); navigate(`/recipes/${recipe.id}/edit`); }}>Edit</button>
                    <button type="button" className="compact-button" onClick={() => { setProductionDraft((current) => ({ ...current, recipeId: recipe.id })); navigate(`/productions/new?recipeId=${recipe.id}`); }}>Production</button>
                    <button type="button" className="compact-button delete-button" onClick={() => deleteRecipe(recipe.id)}>Delete</button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </section>
    );
  }

  function renderRecipeWorkspace() {
    const idFromPath = pathname.split("/")[2];
    const recipe =
      pathname === "/recipes/new"
        ? activeRecipe
        : recipes.find((item) => item.id === idFromPath) ?? activeRecipe;
    if (!recipe) {
      return (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>No recipe selected</h2>
              <p>Create an ingredient first, then add the first Supabase-backed recipe.</p>
            </div>
            <button type="button" className="primary-button" onClick={createRecipe}>
              Create Recipe
            </button>
          </div>
        </section>
      );
    }
    const isReadOnly = /^\/recipes\/[^/]+$/.test(pathname);
    const formulaCost = recipeFormulaCost(recipe, ingredientMap);
    const expectedTotal = formulaCost + recipe.defaultAdditionalCost;
    const yieldPercentage =
      recipe.baseStartingQuantity > 0
        ? (convertQuantity(recipe.expectedYield, recipe.yieldUnit, recipe.baseStartingUnit) /
            recipe.baseStartingQuantity) *
          100
        : 0;
    const expectedLoss = Math.max(
      recipe.baseStartingQuantity -
        convertQuantity(recipe.expectedYield, recipe.yieldUnit, recipe.baseStartingUnit),
      0,
    );
    const costPerYield = recipe.expectedYield > 0 ? expectedTotal / recipe.expectedYield : 0;
    const estimatedPrice = sellingPrice(
      costPerYield * sellingUnitQuantity(recipe.defaultSellingUnit),
      recipe.pricingMethod,
      recipe.pricingPercentage,
    );

    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>{isReadOnly ? "Recipe view" : "Recipe editor"}</h2>
              <p>Base Formula / Method / Expected Yield and Cost</p>
            </div>
            <div className="topbar-actions">
              {isReadOnly ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                >
                  Edit Recipe
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  disabled={savingRecipe}
                  onClick={() => {
                    setSavingRecipe(true);
                    window.setTimeout(() => {
                      updateRecipe(recipe.id, {});
                      setSavingRecipe(false);
                      showToast("success", "Recipe saved successfully.");
                    }, 500);
                  }}
                >
                  {savingRecipe ? "Saving..." : "Save Recipe"}
                </button>
              )}
            </div>
          </div>
          <div className="form-grid four">
            <Field label="Recipe name" required>
              <input
                readOnly={isReadOnly}
                value={recipe.name}
                onChange={(event) => updateRecipe(recipe.id, { name: event.target.value })}
              />
            </Field>
            <Field label="Recipe code" required>
              <input
                readOnly={isReadOnly}
                value={recipe.code}
                onChange={(event) => updateRecipe(recipe.id, { code: event.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                readOnly={isReadOnly}
                value={recipe.category}
                onChange={(event) => updateRecipe(recipe.id, { category: event.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                disabled={isReadOnly}
                value={recipe.status}
                onChange={(event) =>
                  updateRecipe(recipe.id, {
                    status: event.target.value as Recipe["status"],
                  })
                }
              >
                <option>Draft</option>
                <option>Active</option>
                <option>Archived</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Base Formula</h2>
              <p>Formula lines select linked records from the Ingredients List.</p>
            </div>
            {!isReadOnly ? (
              <button type="button" className="compact-button" onClick={() => addFormulaLine(recipe.id)}>
                + Line
              </button>
            ) : null}
          </div>
          <div className="sheet formula-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Ingredient</span>
              <span role="columnheader">Current unit cost</span>
              <span role="columnheader">Formula qty</span>
              <span role="columnheader">Waste %</span>
              <span role="columnheader">Line cost</span>
              <span role="columnheader">Main</span>
              <span role="columnheader">Notes</span>
              <span role="columnheader">Actions</span>
            </div>
            {recipe.formulaLines
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((line) => {
                const ingredient = ingredientMap.get(line.ingredientId);
                return (
                  <div className="sheet-row" role="row" key={line.id}>
                    <span role="cell">
                      <select
                        disabled={isReadOnly}
                        value={line.ingredientId}
                        onChange={(event) =>
                          updateFormulaLine(recipe.id, line.id, {
                            ingredientId: event.target.value,
                          })
                        }
                      >
                        {ingredients.map((ingredientOption) => (
                          <option key={ingredientOption.id} value={ingredientOption.id}>
                            {ingredientOption.name}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span role="cell" className="numeric-cell">
                      {formatMoney(ingredient ? ingredientUnitCost(ingredient) : 0, 4)} /{" "}
                      {ingredient?.baseUnit}
                    </span>
                    <span role="cell" className="quantity-pair">
                      <NumberInput
                        label={`Formula quantity ${ingredient?.name}`}
                        disabled={isReadOnly}
                        value={line.quantity}
                        onChange={(value) =>
                          updateFormulaLine(recipe.id, line.id, { quantity: value })
                        }
                      />
                      <UnitSelect
                        label={`Formula unit ${ingredient?.name}`}
                        disabled={isReadOnly}
                        value={line.unit}
                        onChange={(value) =>
                          updateFormulaLine(recipe.id, line.id, { unit: value })
                        }
                      />
                    </span>
                    <span role="cell">
                      <NumberInput
                        label={`Wastage ${ingredient?.name}`}
                        disabled={isReadOnly}
                        value={line.wastage}
                        onChange={(value) =>
                          updateFormulaLine(recipe.id, line.id, { wastage: value })
                        }
                      />
                    </span>
                    <span role="cell" className="numeric-cell strong-cell">
                      {formatMoney(formulaLineCost(line, ingredientMap))}
                    </span>
                    <span role="cell" className="center-cell">
                      <input
                        type="radio"
                        disabled={isReadOnly}
                        checked={line.isMain}
                        onChange={() => setMainFormulaLine(recipe.id, line.id)}
                        aria-label={`Main ingredient ${ingredient?.name}`}
                      />
                    </span>
                    <span role="cell">
                      <input
                        readOnly={isReadOnly}
                        value={line.notes}
                        onChange={(event) =>
                          updateFormulaLine(recipe.id, line.id, {
                            notes: event.target.value,
                          })
                        }
                        aria-label={`Notes ${ingredient?.name}`}
                      />
                    </span>
                    <span role="cell" className="action-cell">
                      <label className="toggle-mini">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={line.optional}
                          onChange={(event) =>
                            updateFormulaLine(recipe.id, line.id, {
                              optional: event.target.checked,
                            })
                          }
                        />
                        Opt
                      </label>
                      {!isReadOnly ? (
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Delete"
                          onClick={() => removeFormulaLine(recipe.id, line.id)}
                        >
                          X
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            <div className="sheet-total" role="row">
              <span role="cell">Base Formula Cost</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" className="numeric-cell">{formatMoney(formulaCost)}</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
            </div>
          </div>
        </section>

        <section className="two-column-section">
          <section className="panel">
            <div className="section-title">
              <div>
                <h2>Method</h2>
                <p>Saved method steps are copied into each production batch.</p>
              </div>
              {!isReadOnly ? (
                <button
                  type="button"
                  className="compact-button"
                  onClick={() => addMethodStep(recipe.id)}
                >
                  + Step
                </button>
              ) : null}
            </div>
            <Field label="Method introduction">
              <textarea
                readOnly={isReadOnly}
                value={recipe.methodIntro}
                onChange={(event) =>
                  updateRecipe(recipe.id, { methodIntro: event.target.value })
                }
              />
            </Field>
            <div className="method-list">
              {recipe.methodSteps.map((step, index) => (
                <article className="method-step" key={step.id}>
                  <div className="step-index">{index + 1}</div>
                  <div className="method-fields">
                    <div className="form-grid two">
                      <Field label="Step title">
                        <input
                          readOnly={isReadOnly}
                          value={step.title}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              title: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Duration">
                        <input
                          readOnly={isReadOnly}
                          value={step.duration}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              duration: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Temperature">
                        <input
                          readOnly={isReadOnly}
                          value={step.temperature}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              temperature: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Equipment required">
                        <input
                          readOnly={isReadOnly}
                          value={step.equipment}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              equipment: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Instructions">
                        <textarea
                          readOnly={isReadOnly}
                          value={step.instructions}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              instructions: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Step notes">
                        <input
                          readOnly={isReadOnly}
                          value={step.notes}
                          onChange={(event) =>
                            updateMethodStep(recipe.id, step.id, {
                              notes: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                  {!isReadOnly ? (
                    <div className="step-actions">
                      <button type="button" className="icon-button" onClick={() => moveMethodStep(recipe.id, step.id, -1)}>^</button>
                      <button type="button" className="icon-button" onClick={() => moveMethodStep(recipe.id, step.id, 1)}>v</button>
                      <button type="button" className="icon-button danger" onClick={() => removeMethodStep(recipe.id, step.id)}>X</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <h2>Expected Yield and Cost</h2>
                <p>Estimates only. Completed batches recalculate from actual yield.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Base starting quantity">
                <span className="quantity-pair">
                  <NumberInput disabled={isReadOnly} value={recipe.baseStartingQuantity} label="Base starting quantity" onChange={(value) => updateRecipe(recipe.id, { baseStartingQuantity: value })} />
                  <UnitSelect disabled={isReadOnly} value={recipe.baseStartingUnit} label="Base starting unit" onChange={(value) => updateRecipe(recipe.id, { baseStartingUnit: value })} />
                </span>
              </Field>
              <Field label="Expected completed yield">
                <span className="quantity-pair">
                  <NumberInput disabled={isReadOnly} value={recipe.expectedYield} label="Expected yield" onChange={(value) => updateRecipe(recipe.id, { expectedYield: value })} />
                  <UnitSelect disabled={isReadOnly} value={recipe.yieldUnit} label="Expected yield unit" onChange={(value) => updateRecipe(recipe.id, { yieldUnit: value })} />
                </span>
              </Field>
              <Field label="Default additional cost">
                <NumberInput disabled={isReadOnly} value={recipe.defaultAdditionalCost} label="Default additional cost" onChange={(value) => updateRecipe(recipe.id, { defaultAdditionalCost: value })} />
              </Field>
              <Field label="Default pricing %">
                <NumberInput disabled={isReadOnly} value={recipe.pricingPercentage} label="Default pricing percentage" onChange={(value) => updateRecipe(recipe.id, { pricingPercentage: value })} />
              </Field>
              <Field label="Pricing method">
                <select
                  disabled={isReadOnly}
                  value={recipe.pricingMethod}
                  onChange={(event) =>
                    updateRecipe(recipe.id, {
                      pricingMethod: event.target.value as Recipe["pricingMethod"],
                    })
                  }
                >
                  <option>Gross Margin</option>
                  <option>Markup</option>
                </select>
              </Field>
              <Field label="Default selling unit">
                <select
                  disabled={isReadOnly}
                  value={recipe.defaultSellingUnit}
                  onChange={(event) =>
                    updateRecipe(recipe.id, { defaultSellingUnit: event.target.value })
                  }
                >
                  <option>Per kg</option>
                  <option>Per 500 g</option>
                  <option>Per 250 g</option>
                  <option>Per 100 g</option>
                  <option>Per packet</option>
                  <option>Per portion</option>
                  <option>Per item</option>
                </select>
              </Field>
            </div>
            <div className="metric-grid yield-metrics">
              <div><span>Expected yield %</span><strong>{formatNumber(yieldPercentage, 2)}%</strong></div>
              <div><span>Expected loss</span><strong>{formatNumber(expectedLoss, 3)} {recipe.baseStartingUnit}</strong></div>
              <div><span>Expected total cost</span><strong>{formatMoney(expectedTotal)}</strong></div>
              <div><span>Cost per yield unit</span><strong>{formatMoney(costPerYield)}</strong></div>
              <div><span>Default selling unit</span><strong>{recipe.defaultSellingUnit}</strong></div>
              <div><span>Expected selling price</span><strong>{formatMoney(estimatedPrice)}</strong></div>
            </div>
          </section>
        </section>
      </section>
    );
  }

  function renderProductionsSummary() {
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Productions</h2>
              <p>Summary page with sub-navigation for production work.</p>
            </div>
          </div>
          <div className="subnav-grid">
            {[
              ["New Production", "/productions/new", "Select a saved recipe and start a batch."],
              ["In Progress", "/productions/in-progress", "Work on active production batches."],
              ["Completed", "/productions/completed", "Read-only completed production history."],
            ].map(([title, href, copy]) => (
              <button key={href} type="button" className="subnav-tile" onClick={() => navigate(href)}>
                <strong>{title}</strong>
                <small>{copy}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
    );
  }

  function renderNewProduction() {
    if (!selectedProductionRecipe) {
      return (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>New Production</h2>
              <p>Create and save a recipe before starting a production batch.</p>
            </div>
            <button type="button" className="primary-button" onClick={createRecipe}>
              Create Recipe
            </button>
          </div>
        </section>
      );
    }
    const recipeFromQuery = query.get("recipeId");
    if (recipeFromQuery && recipeFromQuery !== productionDraft.recipeId) {
      window.setTimeout(() =>
        setProductionDraft((current) => ({ ...current, recipeId: recipeFromQuery })),
      );
    }
    const mainLine = recipeMainLine(selectedProductionRecipe);
    const scalingFactor =
      mainLine && mainLine.quantity > 0
        ? convertQuantity(
            productionDraft.mainQuantity,
            productionDraft.mainUnit,
            mainLine.unit,
          ) / mainLine.quantity
        : 1;
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>New Production</h2>
              <p>Select a saved recipe, confirm the version, then start the batch.</p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={startingProduction}
              onClick={startProduction}
            >
              {startingProduction ? "Starting..." : "Start Production"}
            </button>
          </div>
          <div className="form-grid four">
            <Field label="Saved recipe" required>
              <select
                value={productionDraft.recipeId}
                onChange={(event) =>
                  setProductionDraft((current) => ({
                    ...current,
                    recipeId: event.target.value,
                  }))
                }
              >
                {recipes.map((recipeOption) => (
                  <option key={recipeOption.id} value={recipeOption.id}>
                    {recipeOption.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Recipe version"><input readOnly value={`v${selectedProductionRecipe.version}`} /></Field>
            <Field label="Main quantity used">
              <span className="quantity-pair">
                <NumberInput label="Main quantity" value={productionDraft.mainQuantity} onChange={(value) => setProductionDraft((current) => ({ ...current, mainQuantity: value }))} />
                <UnitSelect label="Main unit" value={productionDraft.mainUnit} onChange={(value) => setProductionDraft((current) => ({ ...current, mainUnit: value }))} />
              </span>
            </Field>
            <Field label="Start date and time">
              <input type="datetime-local" value={productionDraft.startDate} onChange={(event) => setProductionDraft((current) => ({ ...current, startDate: event.target.value }))} />
            </Field>
            <Field label="Responsible user"><input value={productionDraft.responsible} onChange={(event) => setProductionDraft((current) => ({ ...current, responsible: event.target.value }))} /></Field>
            <Field label="Location"><input value={productionDraft.location} onChange={(event) => setProductionDraft((current) => ({ ...current, location: event.target.value }))} /></Field>
            <Field label="Current notes"><textarea value={productionDraft.notes} onChange={(event) => setProductionDraft((current) => ({ ...current, notes: event.target.value }))} /></Field>
          </div>
          <div className="calculation-strip inline-strip">
            <span>Scaling Factor</span>
            <strong>{formatNumber(scalingFactor, 3)}x</strong>
            <small>
              {formatNumber(productionDraft.mainQuantity, 3)} {productionDraft.mainUnit} /{" "}
              {formatNumber(mainLine?.quantity ?? 0, 3)} {mainLine?.unit}
            </small>
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Calculated production ingredients</h2>
              <p>Actual quantity can be adjusted without changing the recipe formula.</p>
            </div>
          </div>
          {renderProductionLinesTable(productionDraftLines, { readOnly: true })}
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Production method snapshot</h2>
              <p>This method version is saved into the batch when started.</p>
            </div>
          </div>
          <div className="method-list">
            {selectedProductionRecipe.methodSteps.map((step, index) => (
              <article className="method-step" key={step.id}>
                <div className="step-index">{index + 1}</div>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.instructions}</p>
                  <small>{step.duration} / {step.temperature} / {step.equipment}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    );
  }

  function renderProductionLinesTable(
    lines: ProductionLine[],
    options: { productionId?: string; readOnly?: boolean } = {},
  ) {
    const isReadOnly = options.readOnly ?? false;
    return (
      <div className="sheet production-line-sheet" role="table">
        <div className="sheet-head" role="row">
          <span role="columnheader">Ingredient</span>
          <span role="columnheader">Base formula</span>
          <span role="columnheader">Required</span>
          <span role="columnheader">Actual</span>
          <span role="columnheader">Variance</span>
          <span role="columnheader">Expected cost</span>
          <span role="columnheader">Actual cost</span>
          <span role="columnheader">Notes</span>
        </div>
        {lines.map((line) => {
          const ingredient = ingredientMap.get(line.ingredientId);
          const variance =
            convertQuantity(line.actualQuantity, line.actualUnit, line.unit) -
            line.requiredQuantity;
          return (
            <div className="sheet-row" role="row" key={line.id}>
              <span role="cell"><strong>{ingredient?.name}</strong></span>
              <span role="cell" className="numeric-cell">{formatNumber(line.baseQuantity, 3)} {line.unit}</span>
              <span role="cell" className="numeric-cell">{formatNumber(line.requiredQuantity, 3)} {line.unit}</span>
              <span
                role="cell"
                className={options.productionId && !isReadOnly ? "quantity-pair" : "numeric-cell"}
              >
                {options.productionId && !isReadOnly ? (
                  <>
                    <NumberInput
                      label={`Actual quantity ${ingredient?.name}`}
                      value={line.actualQuantity}
                      onChange={(value) =>
                        updateProductionLine(options.productionId!, line.id, {
                          actualQuantity: value,
                        })
                      }
                    />
                    <UnitSelect
                      label={`Actual unit ${ingredient?.name}`}
                      value={line.actualUnit}
                      onChange={(value) =>
                        updateProductionLine(options.productionId!, line.id, {
                          actualUnit: value,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    {formatNumber(line.actualQuantity, 3)} {line.actualUnit}
                  </>
                )}
              </span>
              <span role="cell" className="numeric-cell">{formatNumber(variance, 3)} {line.unit}</span>
              <span role="cell" className="numeric-cell">{formatMoney(line.expectedCost)}</span>
              <span role="cell" className="numeric-cell strong-cell">{formatMoney(line.actualCost)}</span>
              <span role="cell" className="muted-cell">
                {options.productionId && !isReadOnly ? (
                  <input
                    value={line.notes}
                    aria-label={`Production line notes ${ingredient?.name}`}
                    onChange={(event) =>
                      updateProductionLine(options.productionId!, line.id, {
                        notes: event.target.value,
                      })
                    }
                  />
                ) : (
                  line.notes
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderInProgress() {
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>In Progress Productions</h2>
              <p>Working area for active production batches.</p>
            </div>
          </div>
          <div className="sheet production-summary-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Batch</span>
              <span role="columnheader">Recipe</span>
              <span role="columnheader">Main qty</span>
              <span role="columnheader">Start</span>
              <span role="columnheader">Elapsed</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Responsible</span>
              <span role="columnheader">Location</span>
              <span role="columnheader">Expected</span>
              <span role="columnheader">Notes</span>
              <span role="columnheader">Actions</span>
            </div>
            {activeProductions.map((production) => (
              <div className="sheet-row" role="row" key={production.id}>
                <span role="cell"><strong>{production.batchNumber}</strong></span>
                <span role="cell" className="muted-cell">{production.recipeName}</span>
                <span role="cell" className="numeric-cell">{formatNumber(production.mainQuantity, 3)} {production.mainUnit}</span>
                <span role="cell" className="muted-cell">{production.startDate}</span>
                <span role="cell">1 d 3 h</span>
                <span role="cell">
                  <select
                    value={production.status}
                    onChange={(event) => updateProduction(production.id, { status: event.target.value as ProductionBatch["status"] })}
                  >
                    <option>In Progress</option>
                    <option>Resting</option>
                    <option>Drying</option>
                    <option>Awaiting Review</option>
                    <option>On Hold</option>
                  </select>
                </span>
                <span role="cell">{production.responsible}</span>
                <span role="cell">{production.location}</span>
                <span role="cell">{production.expectedCompletion}</span>
                <span role="cell" className="muted-cell">{production.notes}</span>
                <span role="cell" className="action-cell wide-actions">
                  <button type="button" className="compact-button" onClick={() => navigate(`/productions/${production.id}`)}>Open Production</button>
                  <button type="button" className="compact-button" onClick={() => showToast("info", "Progress note added.")}>Add Note</button>
                  <button type="button" className="compact-button" onClick={() => navigate(`/productions/${production.id}`)}>Complete Production</button>
                </span>
              </div>
            ))}
            {activeProductions.length === 0 ? <div className="sheet-empty">No active productions</div> : null}
          </div>
        </section>
      </section>
    );
  }

  function renderProductionDetail() {
    const productionId = pathname.split("/")[2];
    const production = productions.find((item) => item.id === productionId);
    if (!production) {
      return (
        <section className="panel">
          <h2>Production not found</h2>
        </section>
      );
    }
    const isCompleted = production.status === "Completed";
    const ingredientCost = production.lines.reduce((sum, line) => sum + line.actualCost, 0);
    const additionalCost = production.additionalCosts.reduce((sum, cost) => sum + cost.quantity * cost.rate, 0);
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>{production.batchNumber}</h2>
              <p>{production.recipeName} v{production.recipeVersion}</p>
            </div>
            <strong className="status-chip">{production.status}</strong>
          </div>
          <div className="metric-grid">
            <div><span>Main quantity</span><strong>{formatNumber(production.mainQuantity, 3)} {production.mainUnit}</strong></div>
            <div><span>Ingredient cost</span><strong>{formatMoney(ingredientCost)}</strong></div>
            <div><span>Additional cost</span><strong>{formatMoney(additionalCost)}</strong></div>
            <div><span>Current total</span><strong>{formatMoney(ingredientCost + additionalCost)}</strong></div>
          </div>
        </section>
        <section className="panel">
          <div className="section-title"><div><h2>Ingredient snapshot</h2><p>Required quantities and cost snapshots saved when started.</p></div></div>
          {renderProductionLinesTable(production.lines, {
            productionId: production.id,
            readOnly: isCompleted,
          })}
        </section>
        <section className="two-column-section">
          <section className="panel">
            <div className="section-title"><div><h2>Method snapshot</h2><p>Read from the recipe version used at start.</p></div></div>
            <div className="method-list">
              {production.methodSnapshot.map((step, index) => (
                <article className="method-step" key={step.id}>
                  <div className="step-index">{index + 1}</div>
                  <div><strong>{step.title}</strong><p>{step.instructions}</p></div>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <h2>Completion</h2>
                <p>
                  {isCompleted
                    ? "Completed batches are read-only and use actual completed yield."
                    : "Required before moving to Completed."}
                </p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="End date and time" required><input readOnly={isCompleted} type="datetime-local" value={production.endDate} onChange={(event) => updateProduction(production.id, { endDate: event.target.value })} /></Field>
              <Field label="Starting yield" required><NumberInput disabled={isCompleted} value={production.startingYield} label="Starting yield" onChange={(value) => updateProduction(production.id, { startingYield: value })} /></Field>
              <Field label="Completed yield" required><NumberInput disabled={isCompleted} value={production.completedYield} label="Completed yield" onChange={(value) => updateProduction(production.id, { completedYield: value })} /></Field>
              <Field label="Yield unit"><UnitSelect disabled={isCompleted} value={production.yieldUnit} label="Completed yield unit" onChange={(value) => updateProduction(production.id, { yieldUnit: value })} /></Field>
              <Field label="Quality rating" required><input readOnly={isCompleted} value={production.qualityRating} onChange={(event) => updateProduction(production.id, { qualityRating: event.target.value })} /></Field>
              <Field label="Completed by" required><input readOnly={isCompleted} value={production.completedBy} onChange={(event) => updateProduction(production.id, { completedBy: event.target.value })} /></Field>
              <Field label="Outcome notes"><textarea readOnly={isCompleted} value={production.outcomeNotes} onChange={(event) => updateProduction(production.id, { outcomeNotes: event.target.value })} /></Field>
            </div>
            {isCompleted ? (
              <button type="button" className="ghost-button block-action" onClick={() => navigate("/productions/completed")}>Back to Completed</button>
            ) : (
              <button type="button" className="primary-button block-action" onClick={() => completeProduction(production)}>Complete Production</button>
            )}
          </section>
        </section>
      </section>
    );
  }

  function renderCompletedProductions() {
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Completed Productions</h2>
              <p>Read-only production history using final actual yield and cost snapshots.</p>
            </div>
          </div>
          <div className="sheet completed-sheet" role="table">
            <div className="sheet-head" role="row">
              <span role="columnheader">Batch</span>
              <span role="columnheader">Recipe</span>
              <span role="columnheader">Start</span>
              <span role="columnheader">End</span>
              <span role="columnheader">Yield</span>
              <span role="columnheader">Loss</span>
              <span role="columnheader">Total cost</span>
              <span role="columnheader">Cost/yield</span>
              <span role="columnheader">Selling price</span>
              <span role="columnheader">Margin</span>
              <span role="columnheader">Actions</span>
            </div>
            {completedProductions.map((production) => {
              const yieldPct = production.startingYield > 0 ? (production.completedYield / production.startingYield) * 100 : 0;
              const loss = Math.max(production.startingYield - production.completedYield, 0);
              const profit = (production.finalSellingPrice ?? 0) - (production.finalCostPerYield ?? 0);
              const margin = production.finalSellingPrice ? (profit / production.finalSellingPrice) * 100 : 0;
              return (
                <div className="sheet-row" role="row" key={production.id}>
                  <span role="cell"><strong>{production.batchNumber}</strong></span>
                  <span role="cell" className="muted-cell">{production.recipeName} v{production.recipeVersion}</span>
                  <span role="cell">{production.startDate}</span>
                  <span role="cell">{production.endDate}</span>
                  <span role="cell" className="numeric-cell">{formatNumber(yieldPct, 2)}%</span>
                  <span role="cell" className="numeric-cell">{formatNumber(loss, 3)} {production.yieldUnit}</span>
                  <span role="cell" className="numeric-cell strong-cell">{formatMoney(production.finalTotalCost ?? 0)}</span>
                  <span role="cell" className="numeric-cell">{formatMoney(production.finalCostPerYield ?? 0)}</span>
                  <span role="cell" className="numeric-cell">{formatMoney(production.finalSellingPrice ?? 0)}</span>
                  <span role="cell" className="numeric-cell">{formatNumber(margin, 2)}%</span>
                  <span role="cell" className="action-cell wide-actions">
                    <button type="button" className="compact-button" onClick={() => navigate(`/productions/${production.id}`)}>View</button>
                    <button type="button" className="compact-button" onClick={() => showToast("info", "Print prepared.")}>Print</button>
                    <button type="button" className="compact-button" onClick={() => showToast("info", "Export prepared.")}>Export</button>
                    <button type="button" className="compact-button" onClick={() => { setProductionDraft((current) => ({ ...current, recipeId: production.recipeId })); navigate("/productions/new"); }}>Duplicate as New</button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    );
  }

  function renderReports() {
    const totalCompletedCost = completedProductions.reduce(
      (sum, production) => sum + (production.finalTotalCost ?? 0),
      0,
    );
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title"><div><h2>Reports</h2><p>Yield, costing and profitability summaries.</p></div></div>
          <div className="report-grid">
            <div className="report-cell"><span>Completed cost</span><strong>{formatMoney(totalCompletedCost)}</strong><small>Actual completed production costs.</small></div>
            <div className="report-cell"><span>Average cost per kg</span><strong>{formatMoney(completedProductions[0]?.finalCostPerYield ?? 0)}</strong><small>Uses completed yield.</small></div>
            <div className="report-cell"><span>Active batches</span><strong>{activeProductions.length}</strong><small>Not yet completed.</small></div>
            <div className="report-cell"><span>Recipe count</span><strong>{recipes.length}</strong><small>Current formulas.</small></div>
          </div>
        </section>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title"><div><h2>Settings</h2><p>Lookup data and costing policies.</p></div></div>
          <div className="settings-grid">
            <div><strong>Units of measure</strong><small>{units.join(", ")}</small></div>
            <div><strong>Production statuses</strong><small>Draft, In Progress, Resting, Drying, Awaiting Review, On Hold, Completed, Cancelled</small></div>
            <div><strong>Historical costing</strong><small>Completed productions retain formula, method and ingredient cost snapshots.</small></div>
            <div><strong>Pricing methods</strong><small>Markup and Gross Margin are calculated separately.</small></div>
            <div><strong>Additional cost types</strong><small>{additionalCostTypes.join(", ")}</small></div>
          </div>
        </section>
      </section>
    );
  }
}

function pageTitleForPath(pathname: string) {
  if (pathname === "/" || pathname === "/dashboard") {
    return {
      title: "Dashboard",
      description: "A compact overview of recipe, ingredient and production activity.",
    };
  }
  if (pathname === "/ingredients") {
    return {
      title: "Ingredients List",
      description: "Maintain ingredients, purchase costs, suppliers and recipe units.",
    };
  }
  if (pathname.startsWith("/recipes/")) {
    return {
      title: pathname.endsWith("/edit") || pathname === "/recipes/new" ? "Recipe Builder" : "Recipe Detail",
      description: "Build the base formula, method, expected yield and cost estimate.",
    };
  }
  if (pathname === "/recipes") {
    return {
      title: "Recipes",
      description: "Create, view, edit, duplicate and archive production formulas.",
    };
  }
  if (pathname.startsWith("/productions")) {
    return {
      title:
        pathname === "/productions/new"
          ? "New Production"
          : pathname === "/productions/in-progress"
            ? "In Progress Productions"
            : pathname === "/productions/completed"
              ? "Completed Productions"
              : "Productions",
      description: "Start batches, track work in progress and retain completed snapshots.",
    };
  }
  if (pathname === "/reports") {
    return {
      title: "Reports",
      description: "Review yield, costing and profitability using actual completed values.",
    };
  }
  return {
    title: "Settings",
    description: "Manage lookup values and application-level costing rules.",
  };
}

function isActiveNav(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
