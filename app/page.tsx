"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

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
  name: string;
  category: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCost: number;
  baseUnit: Unit;
  supplier: string;
  sku: string;
  notes: string;
  active: boolean;
};

type FormulaLine = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  isMain: boolean;
  optional: boolean;
  wastage: number;
  notes: string;
};

type MethodStep = {
  id: string;
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
  name: string;
  code: string;
  category: string;
  description: string;
  expectedYield: number;
  yieldUnit: Unit;
  pricingMethod: string;
  profitPercentage: number;
  status: string;
  image: string;
  version: string;
};

type SavedRecipe = Recipe & {
  id: string;
  updatedAt: string;
  formulaLines: FormulaLine[];
  methodSteps: MethodStep[];
};

type Toast = {
  kind: "success" | "failed" | "warning" | "info";
  message: string;
};

const savedRecipesStorageKey = "recipe-cost-calculator:saved-recipes";

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

const statuses = [
  "Draft",
  "Scheduled",
  "In Progress",
  "Resting",
  "Drying",
  "Ready for Review",
  "Completed",
  "Failed",
  "Cancelled",
];

const costTypes = [
  "Labour",
  "Electricity",
  "Packaging",
  "Labels",
  "Delivery",
  "Equipment use",
  "Storage",
  "Other overhead",
];

const massUnits: Partial<Record<Unit, number>> = { kg: 1000, g: 1 };
const volumeUnits: Partial<Record<Unit, number>> = { L: 1000, ml: 1 };

const initialIngredients: Ingredient[] = [
  {
    id: "silverside",
    name: "Silverside",
    category: "Meat",
    purchaseQuantity: 5,
    purchaseUnit: "kg",
    purchaseCost: 645,
    baseUnit: "kg",
    supplier: "Karoo Butchery",
    sku: "MEAT-SILV-5KG",
    notes: "Trimmed beef, chilled.",
    active: true,
  },
  {
    id: "coarse-salt",
    name: "Coarse Salt",
    category: "Seasoning",
    purchaseQuantity: 10,
    purchaseUnit: "kg",
    purchaseCost: 122.5,
    baseUnit: "g",
    supplier: "Cape Dry Goods",
    sku: "DRY-SALT-10KG",
    notes: "Food-grade coarse salt.",
    active: true,
  },
  {
    id: "coriander",
    name: "Whole Coriander",
    category: "Spice",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    purchaseCost: 145,
    baseUnit: "g",
    supplier: "Spice Route",
    sku: "SPC-CORI-1KG",
    notes: "Toast before cracking.",
    active: true,
  },
  {
    id: "black-pepper",
    name: "Coarse Black Pepper",
    category: "Spice",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    purchaseCost: 190,
    baseUnit: "g",
    supplier: "Spice Route",
    sku: "SPC-PEPP-1KG",
    notes: "Coarse milled.",
    active: true,
  },
  {
    id: "vinegar",
    name: "Brown Vinegar",
    category: "Liquid",
    purchaseQuantity: 5,
    purchaseUnit: "L",
    purchaseCost: 88,
    baseUnit: "ml",
    supplier: "Pantry Wholesale",
    sku: "LIQ-VINE-5L",
    notes: "Standard brown vinegar.",
    active: true,
  },
  {
    id: "bicarb",
    name: "Bicarbonate of Soda",
    category: "Additive",
    purchaseQuantity: 500,
    purchaseUnit: "g",
    purchaseCost: 36,
    baseUnit: "g",
    supplier: "Cape Dry Goods",
    sku: "ADD-BIC-500G",
    notes: "Fine powder.",
    active: true,
  },
];

const initialFormulaLines: FormulaLine[] = [
  {
    id: "line-silverside",
    ingredientId: "silverside",
    quantity: 1,
    unit: "kg",
    isMain: true,
    optional: false,
    wastage: 0,
    notes: "Scaling ingredient",
  },
  {
    id: "line-salt",
    ingredientId: "coarse-salt",
    quantity: 20,
    unit: "g",
    isMain: false,
    optional: false,
    wastage: 0,
    notes: "",
  },
  {
    id: "line-coriander",
    ingredientId: "coriander",
    quantity: 12,
    unit: "g",
    isMain: false,
    optional: false,
    wastage: 2,
    notes: "Cracked",
  },
  {
    id: "line-pepper",
    ingredientId: "black-pepper",
    quantity: 4,
    unit: "g",
    isMain: false,
    optional: false,
    wastage: 0,
    notes: "",
  },
  {
    id: "line-vinegar",
    ingredientId: "vinegar",
    quantity: 150,
    unit: "ml",
    isMain: false,
    optional: false,
    wastage: 0,
    notes: "",
  },
  {
    id: "line-bicarb",
    ingredientId: "bicarb",
    quantity: 2,
    unit: "g",
    isMain: false,
    optional: false,
    wastage: 0,
    notes: "",
  },
];

const initialMethodSteps: MethodStep[] = [
  {
    id: "step-1",
    title: "Trim and weigh",
    instructions:
      "Trim silverside and record the usable starting weight before seasoning.",
    duration: "10 min",
    temperature: "Chilled",
    equipment: "Scale, boning knife",
    image: "",
    notes: "Keep the main ingredient quantity accurate.",
  },
  {
    id: "step-2",
    title: "Mix cure",
    instructions:
      "Combine salt, coriander, pepper and bicarbonate, then coat the meat evenly.",
    duration: "8 min",
    temperature: "Ambient",
    equipment: "Mixing bowl, gloves",
    image: "",
    notes: "",
  },
  {
    id: "step-3",
    title: "Rest and review",
    instructions:
      "Add vinegar, cover, rest under refrigeration and review final usable yield.",
    duration: "24 h",
    temperature: "2-5 C",
    equipment: "Food-safe tub, chiller",
    image: "",
    notes: "Capture photos for batch record.",
  },
];

const initialRecipe: Recipe = {
  name: "Peppered Silverside",
  code: "BEEF-SILV-001",
  category: "Cured Meat",
  description: "Scalable base formula for peppered silverside batches.",
  expectedYield: 0.9,
  yieldUnit: "kg",
  pricingMethod: "Gross Margin",
  profitPercentage: 42,
  status: "Active",
  image: "",
  version: "1.0",
};

const initialSavedRecipes: SavedRecipe[] = [
  {
    ...initialRecipe,
    id: "recipe-silverside",
    updatedAt: "23 Jul 2026, 09:42",
    formulaLines: initialFormulaLines,
    methodSteps: initialMethodSteps,
  },
  {
    id: "recipe-biltong",
    name: "Coriander Biltong Slab",
    code: "BEEF-BILT-002",
    category: "Dried Meat",
    description: "Leaner biltong formula with heavier coriander and drying loss.",
    expectedYield: 0.62,
    yieldUnit: "kg",
    pricingMethod: "Gross Margin",
    profitPercentage: 48,
    status: "Active",
    image: "",
    version: "1.2",
    updatedAt: "22 Jul 2026, 15:18",
    formulaLines: [
      {
        id: "biltong-silverside",
        ingredientId: "silverside",
        quantity: 1,
        unit: "kg",
        isMain: true,
        optional: false,
        wastage: 0,
        notes: "Trim lean",
      },
      {
        id: "biltong-salt",
        ingredientId: "coarse-salt",
        quantity: 24,
        unit: "g",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "",
      },
      {
        id: "biltong-coriander",
        ingredientId: "coriander",
        quantity: 18,
        unit: "g",
        isMain: false,
        optional: false,
        wastage: 3,
        notes: "Toasted and cracked",
      },
      {
        id: "biltong-pepper",
        ingredientId: "black-pepper",
        quantity: 5,
        unit: "g",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "",
      },
      {
        id: "biltong-vinegar",
        ingredientId: "vinegar",
        quantity: 120,
        unit: "ml",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "Dip before curing",
      },
    ],
    methodSteps: [
      {
        id: "biltong-step-1",
        title: "Cut slabs",
        instructions: "Trim and cut even slabs before weighing the batch.",
        duration: "12 min",
        temperature: "Chilled",
        equipment: "Scale, knife",
        image: "",
        notes: "",
      },
      {
        id: "biltong-step-2",
        title: "Cure",
        instructions: "Apply dry cure and rest under refrigeration.",
        duration: "12 h",
        temperature: "2-5 C",
        equipment: "Food-safe tub",
        image: "",
        notes: "",
      },
      {
        id: "biltong-step-3",
        title: "Dry",
        instructions: "Hang until target moisture loss is reached.",
        duration: "72 h",
        temperature: "18-22 C",
        equipment: "Drying cabinet",
        image: "",
        notes: "Record final yield before packing.",
      },
    ],
  },
  {
    id: "recipe-jerky",
    name: "Vinegar Beef Jerky",
    code: "BEEF-JERK-003",
    category: "Snack",
    description: "Thin-cut jerky batch with higher vinegar marinade ratio.",
    expectedYield: 0.52,
    yieldUnit: "kg",
    pricingMethod: "Markup",
    profitPercentage: 75,
    status: "Draft",
    image: "",
    version: "0.8",
    updatedAt: "21 Jul 2026, 11:05",
    formulaLines: [
      {
        id: "jerky-silverside",
        ingredientId: "silverside",
        quantity: 1,
        unit: "kg",
        isMain: true,
        optional: false,
        wastage: 0,
        notes: "Slice thin",
      },
      {
        id: "jerky-vinegar",
        ingredientId: "vinegar",
        quantity: 220,
        unit: "ml",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "Marinade",
      },
      {
        id: "jerky-salt",
        ingredientId: "coarse-salt",
        quantity: 18,
        unit: "g",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "",
      },
      {
        id: "jerky-pepper",
        ingredientId: "black-pepper",
        quantity: 8,
        unit: "g",
        isMain: false,
        optional: false,
        wastage: 0,
        notes: "",
      },
      {
        id: "jerky-coriander",
        ingredientId: "coriander",
        quantity: 6,
        unit: "g",
        isMain: false,
        optional: true,
        wastage: 0,
        notes: "Optional batch note",
      },
    ],
    methodSteps: [
      {
        id: "jerky-step-1",
        title: "Slice",
        instructions: "Slice silverside evenly for fast drying.",
        duration: "18 min",
        temperature: "Chilled",
        equipment: "Slicer, scale",
        image: "",
        notes: "",
      },
      {
        id: "jerky-step-2",
        title: "Marinate",
        instructions: "Mix marinade and rest under refrigeration.",
        duration: "8 h",
        temperature: "2-5 C",
        equipment: "Tub, gloves",
        image: "",
        notes: "",
      },
    ],
  },
];

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

function ingredientBaseCost(ingredient: Ingredient) {
  const convertedPurchaseQuantity = convertQuantity(
    ingredient.purchaseQuantity,
    ingredient.purchaseUnit,
    ingredient.baseUnit,
  );

  if (convertedPurchaseQuantity <= 0) return 0;
  return ingredient.purchaseCost / convertedPurchaseQuantity;
}

function cloneFormulaLines(lines: FormulaLine[]) {
  return lines.map((line) => ({ ...line }));
}

function cloneMethodSteps(steps: MethodStep[]) {
  return steps.map((step) => ({ ...step }));
}

function formulaCostForLines(
  lines: FormulaLine[],
  ingredientMap: Map<string, Ingredient>,
) {
  return lines.reduce((sum, line) => {
    const ingredient = ingredientMap.get(line.ingredientId);
    if (!ingredient) return sum;
    const convertedQuantity = convertQuantity(
      line.quantity,
      line.unit,
      ingredient.baseUnit,
    );
    return (
      sum +
      convertedQuantity * ingredientBaseCost(ingredient) * (1 + line.wastage / 100)
    );
  }, 0);
}

function recipeMainIngredientName(
  lines: FormulaLine[],
  ingredientMap: Map<string, Ingredient>,
) {
  const mainLine = lines.find((line) => line.isMain) ?? lines[0];
  return mainLine
    ? (ingredientMap.get(mainLine.ingredientId)?.name ?? "Unassigned")
    : "Unassigned";
}

function recipeFieldsFromSaved(savedRecipe: SavedRecipe): Recipe {
  const { id, updatedAt, formulaLines, methodSteps, ...recipeFields } =
    savedRecipe;
  void id;
  void updatedAt;
  void formulaLines;
  void methodSteps;
  return recipeFields;
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) value = 0;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(value);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      <span>
        {label}
        {required ? <b aria-label="required">*</b> : null}
      </span>
      {children}
    </label>
  );
}

function UnitSelect({
  value,
  onChange,
  label,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
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
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: string;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      min="0"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(toNumber(event.target.value))}
    />
  );
}

export default function Home() {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [formulaLines, setFormulaLines] = useState(initialFormulaLines);
  const [methodSteps, setMethodSteps] = useState(initialMethodSteps);
  const [savedRecipes, setSavedRecipes] = useState(initialSavedRecipes);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(
    "recipe-silverside",
  );
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);

  const [production, setProduction] = useState({
    batchNumber: "PB-2026-0001",
    business: "Central Kitchen",
    location: "Cape Town",
    productionArea: "Curing room",
    responsible: "A. Carstens",
    status: "In Progress",
    start: "2026-07-23T08:00",
    end: "2026-07-24T08:00",
    mainQuantity: 1.5,
    mainUnit: "kg" as Unit,
    startingYield: 1.5,
    startingYieldUnit: "kg" as Unit,
    endYield: 0.9,
    endYieldUnit: "kg" as Unit,
    preNotes: "Silverside trimmed and weighed before curing.",
    duringNotes: "Cure mix applied evenly.",
    outcomeNotes: "Review after resting.",
    qualityRating: "4",
    photos: "",
    completedBy: "",
    approvedBy: "",
  });

  const [usageOverrides, setUsageOverrides] = useState<
    Record<string, { quantity?: number; unit?: Unit; notes?: string }>
  >({});

  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([
    {
      id: "cost-labour",
      type: "Labour",
      description: "Prep and packing time",
      quantity: 1.5,
      rate: 85,
      notes: "",
    },
    {
      id: "cost-packaging",
      type: "Packaging",
      description: "Vacuum bag and label",
      quantity: 3,
      rate: 4.5,
      notes: "Per packed unit",
    },
  ]);

  const [pricing, setPricing] = useState({
    method: "Gross Margin",
    percentage: 42,
    sellingUnit: "Per kg",
    customQuantity: 500,
    customUnit: "g" as Unit,
  });

  useEffect(() => {
    try {
      const storedRecipes = window.localStorage.getItem(savedRecipesStorageKey);
      if (storedRecipes) {
        const parsedRecipes = JSON.parse(storedRecipes);
        if (
          Array.isArray(parsedRecipes) &&
          parsedRecipes.length > 0 &&
          parsedRecipes[0].formulaLines
        ) {
          const restoredRecipes = parsedRecipes as SavedRecipe[];
          const restoredRecipe = restoredRecipes[0];
          setSavedRecipes(restoredRecipes);
          setActiveRecipeId(restoredRecipe.id);
          setRecipe(recipeFieldsFromSaved(restoredRecipe));
          setFormulaLines(cloneFormulaLines(restoredRecipe.formulaLines));
          setMethodSteps(cloneMethodSteps(restoredRecipe.methodSteps ?? []));
        }
      }
    } catch {
      setToast({
        kind: "warning",
        message: "Saved recipes could not be loaded on this device.",
      });
    } finally {
      setRecipesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!recipesLoaded) return;
    window.localStorage.setItem(
      savedRecipesStorageKey,
      JSON.stringify(savedRecipes),
    );
  }, [recipesLoaded, savedRecipes]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(
      () => setToast(null),
      toast.kind === "failed" ? 3200 : 2100,
    );
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const savedRecipeRows = useMemo(
    () =>
      savedRecipes.map((savedRecipe) => ({
        ...savedRecipe,
        lineCount: savedRecipe.formulaLines.length,
        methodStepCount: savedRecipe.methodSteps.length,
        mainIngredientName: recipeMainIngredientName(
          savedRecipe.formulaLines,
          ingredientMap,
        ),
        formulaCost: formulaCostForLines(savedRecipe.formulaLines, ingredientMap),
      })),
    [ingredientMap, savedRecipes],
  );

  const mainLine = useMemo(
    () => formulaLines.find((line) => line.isMain) ?? formulaLines[0],
    [formulaLines],
  );

  const mainIngredient = mainLine
    ? ingredientMap.get(mainLine.ingredientId)
    : undefined;

  const scalingFactor = useMemo(() => {
    if (!mainLine || mainLine.quantity <= 0) return 1;
    const productionMain = convertQuantity(
      production.mainQuantity,
      production.mainUnit,
      mainLine.unit,
    );
    return productionMain / mainLine.quantity;
  }, [mainLine, production.mainQuantity, production.mainUnit]);

  const formulaRows = useMemo(
    () =>
      formulaLines.map((line, index) => {
        const ingredient = ingredientMap.get(line.ingredientId);
        const baseCost = ingredient ? ingredientBaseCost(ingredient) : 0;
        const convertedQuantity = ingredient
          ? convertQuantity(line.quantity, line.unit, ingredient.baseUnit)
          : 0;
        const lineCost = convertedQuantity * baseCost * (1 + line.wastage / 100);

        return {
          ...line,
          index,
          ingredient,
          baseCost,
          lineCost,
        };
      }),
    [formulaLines, ingredientMap],
  );

  const totalFormulaCost = useMemo(
    () => formulaRows.reduce((sum, row) => sum + row.lineCost, 0),
    [formulaRows],
  );

  const productionRows = useMemo(
    () =>
      formulaRows.map((row) => {
        const requiredQuantity = row.quantity * scalingFactor;
        const override = usageOverrides[row.id];
        const actualQuantity = override?.quantity ?? requiredQuantity;
        const actualUnit = override?.unit ?? row.unit;
        const expectedCost = row.lineCost * scalingFactor;
        const actualConverted = row.ingredient
          ? convertQuantity(actualQuantity, actualUnit, row.ingredient.baseUnit)
          : 0;
        const actualCost = actualConverted * row.baseCost;
        const variance =
          convertQuantity(actualQuantity, actualUnit, row.unit) - requiredQuantity;

        return {
          ...row,
          requiredQuantity,
          actualQuantity,
          actualUnit,
          variance,
          expectedCost,
          actualCost,
          costVariance: actualCost - expectedCost,
          usageNotes: override?.notes ?? "",
        };
      }),
    [formulaRows, scalingFactor, usageOverrides],
  );

  const expectedIngredientCost = productionRows.reduce(
    (sum, row) => sum + row.expectedCost,
    0,
  );
  const actualIngredientCost = productionRows.reduce(
    (sum, row) => sum + row.actualCost,
    0,
  );
  const additionalCostTotal = additionalCosts.reduce(
    (sum, row) => sum + row.quantity * row.rate,
    0,
  );
  const totalProductionCost = actualIngredientCost + additionalCostTotal;

  const startingYieldInEndUnit = convertQuantity(
    production.startingYield,
    production.startingYieldUnit,
    production.endYieldUnit,
  );
  const yieldPercentage =
    startingYieldInEndUnit > 0
      ? (production.endYield / startingYieldInEndUnit) * 100
      : 0;
  const productionLoss = Math.max(startingYieldInEndUnit - production.endYield, 0);
  const lossPercentage =
    startingYieldInEndUnit > 0 ? (productionLoss / startingYieldInEndUnit) * 100 : 0;

  const endYieldKg = convertQuantity(
    production.endYield,
    production.endYieldUnit,
    "kg",
  );
  const costPerKg = endYieldKg > 0 ? totalProductionCost / endYieldKg : 0;

  const sellingUnitKg = useMemo(() => {
    if (pricing.sellingUnit === "Per kg") return 1;
    if (pricing.sellingUnit === "Per 500 g") return 0.5;
    if (pricing.sellingUnit === "Per 250 g") return 0.25;
    if (pricing.sellingUnit === "Per 100 g") return 0.1;
    if (pricing.sellingUnit === "Per portion") return 0.125;
    if (pricing.sellingUnit === "Per packet") return 0.25;
    if (pricing.sellingUnit === "Per item") return 0.1;
    return convertQuantity(pricing.customQuantity, pricing.customUnit, "kg");
  }, [pricing.customQuantity, pricing.customUnit, pricing.sellingUnit]);

  const sellingUnitCost = costPerKg * sellingUnitKg;
  const sellingPrice =
    pricing.method === "Markup"
      ? sellingUnitCost * (1 + pricing.percentage / 100)
      : pricing.percentage >= 100
        ? 0
        : sellingUnitCost / (1 - pricing.percentage / 100);
  const unitProfit = sellingPrice - sellingUnitCost;
  const effectiveMargin =
    sellingPrice > 0 ? ((sellingPrice - sellingUnitCost) / sellingPrice) * 100 : 0;

  const showToast = (kind: Toast["kind"], message: string) => {
    setToast({ kind, message });
  };

  const updateIngredient = <K extends keyof Ingredient>(
    id: string,
    key: K,
    value: Ingredient[K],
  ) => {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, [key]: value } : ingredient,
      ),
    );
  };

  const updateFormulaLine = <K extends keyof FormulaLine>(
    id: string,
    key: K,
    value: FormulaLine[K],
  ) => {
    setFormulaLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [key]: value } : line)),
    );
  };

  const setMainFormulaLine = (id: string) => {
    setFormulaLines((current) =>
      current.map((line) => ({ ...line, isMain: line.id === id })),
    );
  };

  const updateUsage = (
    id: string,
    patch: Partial<{ quantity: number; unit: Unit; notes: string }>,
  ) => {
    setUsageOverrides((current) => ({
      ...current,
      [id]: { ...(current[id] ?? {}), ...patch },
    }));
  };

  const loadSavedRecipe = (savedRecipe: SavedRecipe) => {
    setActiveRecipeId(savedRecipe.id);
    setRecipe(recipeFieldsFromSaved(savedRecipe));
    setFormulaLines(cloneFormulaLines(savedRecipe.formulaLines));
    setMethodSteps(cloneMethodSteps(savedRecipe.methodSteps));
    setUsageOverrides({});
    setPricing((current) => ({
      ...current,
      method: savedRecipe.pricingMethod,
      percentage: savedRecipe.profitPercentage,
    }));
    showToast("success", `${savedRecipe.name} loaded for editing.`);
  };

  const saveCurrentRecipe = () => {
    const savedId = activeRecipeId ?? makeId("recipe");
    const updatedAt = new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    const savedRecipe: SavedRecipe = {
      ...recipe,
      id: savedId,
      updatedAt,
      formulaLines: cloneFormulaLines(formulaLines),
      methodSteps: cloneMethodSteps(methodSteps),
    };

    setSavedRecipes((current) => {
      const exists = current.some((item) => item.id === savedId);
      if (exists) {
        return current.map((item) => (item.id === savedId ? savedRecipe : item));
      }
      return [savedRecipe, ...current];
    });
    setActiveRecipeId(savedId);
  };

  const createNewRecipe = () => {
    const firstActiveIngredient =
      ingredients.find((ingredient) => ingredient.active)?.id ?? "";
    setActiveRecipeId(null);
    setRecipe({
      name: "Untitled Recipe",
      code: `REC-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      category: "New",
      description: "",
      expectedYield: 1,
      yieldUnit: "kg",
      pricingMethod: "Gross Margin",
      profitPercentage: 40,
      status: "Draft",
      image: "",
      version: "0.1",
    });
    setFormulaLines([
      {
        id: makeId("formula"),
        ingredientId: firstActiveIngredient,
        quantity: 1,
        unit: "kg",
        isMain: true,
        optional: false,
        wastage: 0,
        notes: "Scaling ingredient",
      },
    ]);
    setMethodSteps([]);
    setUsageOverrides({});
    setPricing((current) => ({
      ...current,
      method: "Gross Margin",
      percentage: 40,
    }));
    showToast("info", "New unsaved recipe opened.");
  };

  const deleteSavedRecipe = (id: string) => {
    const recipeToDelete = savedRecipes.find((item) => item.id === id);
    const replacement = savedRecipes.find((item) => item.id !== id);

    setSavedRecipes((current) => current.filter((item) => item.id !== id));

    if (activeRecipeId === id) {
      if (replacement) {
        setActiveRecipeId(replacement.id);
        setRecipe(recipeFieldsFromSaved(replacement));
        setFormulaLines(cloneFormulaLines(replacement.formulaLines));
        setMethodSteps(cloneMethodSteps(replacement.methodSteps));
        setPricing((current) => ({
          ...current,
          method: replacement.pricingMethod,
          percentage: replacement.profitPercentage,
        }));
      } else {
        setActiveRecipeId(null);
      }
      setUsageOverrides({});
    }

    showToast(
      "warning",
      recipeToDelete
        ? `${recipeToDelete.name} deleted.`
        : "Recipe could not be found.",
    );
  };

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      {
        id: makeId("ingredient"),
        name: "New ingredient",
        category: "Uncategorised",
        purchaseQuantity: 1,
        purchaseUnit: "kg",
        purchaseCost: 0,
        baseUnit: "kg",
        supplier: "",
        sku: "",
        notes: "",
        active: true,
      },
    ]);
    showToast("info", "Ingredient row added.");
  };

  const addFormulaLine = () => {
    setFormulaLines((current) => [
      ...current,
      {
        id: makeId("formula"),
        ingredientId: ingredients.find((ingredient) => ingredient.active)?.id ?? "",
        quantity: 1,
        unit: "g",
        isMain: current.length === 0,
        optional: false,
        wastage: 0,
        notes: "",
      },
    ]);
  };

  const removeFormulaLine = (id: string) => {
    setFormulaLines((current) => {
      const next = current.filter((line) => line.id !== id);
      if (!next.some((line) => line.isMain) && next[0]) {
        return next.map((line, index) => ({ ...line, isMain: index === 0 }));
      }
      return next;
    });
  };

  const duplicateFormulaLine = (id: string) => {
    setFormulaLines((current) => {
      const line = current.find((item) => item.id === id);
      if (!line) return current;
      return [
        ...current,
        {
          ...line,
          id: makeId("formula"),
          isMain: false,
          notes: line.notes ? `${line.notes} copy` : "Copy",
        },
      ];
    });
  };

  const addCostLine = () => {
    setAdditionalCosts((current) => [
      ...current,
      {
        id: makeId("cost"),
        type: "Other overhead",
        description: "",
        quantity: 1,
        rate: 0,
        notes: "",
      },
    ]);
  };

  const moveStep = (id: string, direction: -1 | 1) => {
    setMethodSteps((current) => {
      const index = current.findIndex((step) => step.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(nextIndex, 0, step);
      return next;
    });
  };

  const dropStep = (targetId: string) => {
    if (!draggingStepId || draggingStepId === targetId) return;
    setMethodSteps((current) => {
      const source = current.find((step) => step.id === draggingStepId);
      if (!source) return current;
      const withoutSource = current.filter((step) => step.id !== draggingStepId);
      const targetIndex = withoutSource.findIndex((step) => step.id === targetId);
      const next = [...withoutSource];
      next.splice(targetIndex, 0, source);
      return next;
    });
    setDraggingStepId(null);
  };

  const simulateSave = (target: "recipe" | "batch") => {
    if (target === "recipe") {
      setSavingRecipe(true);
      window.setTimeout(() => {
        saveCurrentRecipe();
        setSavingRecipe(false);
        showToast("success", "Recipe saved successfully.");
      }, 700);
      return;
    }

    setSavingBatch(true);
    window.setTimeout(() => {
      setSavingBatch(false);
      showToast("success", "Production batch saved successfully.");
    }, 700);
  };

  const toastHeading =
    toast?.kind === "success"
      ? "Successful"
      : toast?.kind === "failed"
        ? "Failed"
        : toast?.kind === "warning"
          ? "Attention"
          : "Notice";

  const toastIcon =
    toast?.kind === "success"
      ? "+"
      : toast?.kind === "failed"
        ? "!"
        : toast?.kind === "warning"
          ? "!"
          : "i";

  return (
    <main className="app-shell">
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className={`toast ${toast.kind}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {toastIcon}
            </span>
            <span>
              <strong>{toastHeading}</strong>
              <small>{toast.message}</small>
            </span>
          </div>
        ) : null}
      </div>

      <aside className="sidebar" aria-label="Application navigation">
        <div className="brand-block">
          <span className="brand-mark">RC</span>
          <span>
            <strong>Recipe Cost</strong>
            <small>Formula operations</small>
          </span>
        </div>
        <nav>
          <a href="#recipes">Recipes</a>
          <a href="#formula">Formula</a>
          <a href="#production">Production</a>
          <a href="#ingredients">Ingredients</a>
          <a href="#method">Method</a>
          <a href="#reports">Reports</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Recipe Formula / Production / Costing</p>
            <h1>{recipe.name}</h1>
            <p>
              Scale every formula line from the main ingredient, compare actual
              usage, and price from final usable yield.
            </p>
          </div>
          <div className="topbar-actions" aria-label="Primary actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => showToast("info", "Version snapshot prepared.")}
            >
              Version {recipe.version}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={savingRecipe}
              onClick={() => simulateSave("recipe")}
            >
              {savingRecipe ? "Saving..." : "Save recipe"}
            </button>
          </div>
        </header>

        <section className="panel" id="recipes">
          <div className="section-title">
            <div>
              <h2>Recipes</h2>
              <p>Saved formulas are stored here for editing or removal.</p>
            </div>
            <button
              type="button"
              className="compact-button"
              onClick={createNewRecipe}
            >
              + Recipe
            </button>
          </div>

          <div className="sheet recipe-sheet" role="table" aria-label="Saved recipes">
            <div className="sheet-head" role="row">
              <span role="columnheader">Recipe</span>
              <span role="columnheader">Code</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Main</span>
              <span role="columnheader">Lines</span>
              <span role="columnheader">Formula cost</span>
              <span role="columnheader">Pricing</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Updated</span>
              <span role="columnheader">Actions</span>
            </div>
            {savedRecipeRows.map((savedRecipe) => (
              <div
                className={`sheet-row ${
                  savedRecipe.id === activeRecipeId ? "selected-row" : ""
                }`}
                role="row"
                key={savedRecipe.id}
              >
                <span role="cell">
                  <strong>{savedRecipe.name}</strong>
                  {savedRecipe.id === activeRecipeId ? <small>Editing</small> : null}
                </span>
                <span role="cell" className="muted-cell">
                  {savedRecipe.code}
                </span>
                <span role="cell" className="muted-cell">
                  {savedRecipe.category}
                </span>
                <span role="cell" className="muted-cell">
                  {savedRecipe.mainIngredientName}
                </span>
                <span role="cell" className="numeric-cell">
                  {savedRecipe.lineCount}
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatCurrency(savedRecipe.formulaCost)}
                </span>
                <span role="cell" className="muted-cell">
                  {savedRecipe.pricingMethod} {formatNumber(savedRecipe.profitPercentage, 1)}%
                </span>
                <span role="cell">
                  <strong className="status-chip muted-status">
                    {savedRecipe.status}
                  </strong>
                </span>
                <span role="cell" className="muted-cell">
                  {savedRecipe.updatedAt}
                </span>
                <span role="cell" className="action-cell">
                  <button
                    type="button"
                    className="compact-button"
                    onClick={() => loadSavedRecipe(savedRecipe)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${savedRecipe.name}`}
                    title="Delete"
                    onClick={() => deleteSavedRecipe(savedRecipe.id)}
                  >
                    X
                  </button>
                </span>
              </div>
            ))}
            {savedRecipeRows.length === 0 ? (
              <div className="sheet-empty">No saved recipes</div>
            ) : null}
          </div>

          <div className="mobile-records" aria-label="Saved recipes mobile">
            {savedRecipeRows.map((savedRecipe) => (
              <details className="sheet-record" key={savedRecipe.id}>
                <summary>
                  <span>
                    <strong>{savedRecipe.name}</strong>
                    <small>
                      {savedRecipe.code} / {savedRecipe.mainIngredientName}
                    </small>
                  </span>
                  <span>{formatCurrency(savedRecipe.formulaCost)}</span>
                </summary>
                <div className="record-grid">
                  <div className="record-metric">
                    <span>Status</span>
                    <strong>{savedRecipe.status}</strong>
                  </div>
                  <div className="record-metric">
                    <span>Formula lines</span>
                    <strong>{savedRecipe.lineCount}</strong>
                  </div>
                  <div className="record-metric">
                    <span>Pricing</span>
                    <strong>
                      {savedRecipe.pricingMethod}{" "}
                      {formatNumber(savedRecipe.profitPercentage, 1)}%
                    </strong>
                  </div>
                  <div className="record-metric">
                    <span>Updated</span>
                    <strong>{savedRecipe.updatedAt}</strong>
                  </div>
                  <div className="record-actions">
                    <button
                      type="button"
                      className="compact-button"
                      onClick={() => loadSavedRecipe(savedRecipe)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="compact-button delete-button"
                      onClick={() => deleteSavedRecipe(savedRecipe.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            ))}
            {savedRecipeRows.length === 0 ? (
              <div className="sheet-record empty-record">No saved recipes</div>
            ) : null}
          </div>
        </section>

        <section className="hero-grid" aria-label="Batch scaling summary">
          <div className="scale-panel" id="formula">
            <div className="section-title">
              <div>
                <h2>Production scaler</h2>
                <p>
                  Main ingredient:{" "}
                  <strong>{mainIngredient?.name ?? "No main ingredient"}</strong>
                </p>
              </div>
              <span className="status-chip">{production.status}</span>
            </div>
            <div className="scale-control">
              <Field label="Main quantity used" required>
                <span className="quantity-pair">
                  <NumberInput
                    label="Main ingredient quantity used"
                    value={production.mainQuantity}
                    onChange={(value) =>
                      setProduction((current) => ({
                        ...current,
                        mainQuantity: value,
                      }))
                    }
                  />
                  <UnitSelect
                    label="Main ingredient unit"
                    value={production.mainUnit}
                    onChange={(value) =>
                      setProduction((current) => ({ ...current, mainUnit: value }))
                    }
                  />
                </span>
              </Field>
              <div className="calculation-strip">
                <span>Scaling factor</span>
                <strong>{formatNumber(scalingFactor, 3)}x</strong>
                <small>
                  {formatNumber(production.mainQuantity, 3)} {production.mainUnit} /{" "}
                  {formatNumber(mainLine?.quantity ?? 0, 3)} {mainLine?.unit ?? ""}
                </small>
              </div>
            </div>
            <div className="mini-output" aria-label="Scaled output preview">
              {productionRows.slice(0, 6).map((row) => (
                <span key={row.id}>
                  <strong>{row.ingredient?.name}</strong>
                  {formatNumber(row.requiredQuantity, row.unit === "kg" ? 3 : 1)}{" "}
                  {row.unit}
                </span>
              ))}
            </div>
          </div>

          <aside className="cost-panel" aria-label="Costing summary">
            <h2>Live costing</h2>
            <dl>
              <div>
                <dt>Formula cost</dt>
                <dd>{formatCurrency(totalFormulaCost)}</dd>
              </div>
              <div>
                <dt>Expected ingredient cost</dt>
                <dd>{formatCurrency(expectedIngredientCost)}</dd>
              </div>
              <div>
                <dt>Actual ingredient cost</dt>
                <dd>{formatCurrency(actualIngredientCost)}</dd>
              </div>
              <div>
                <dt>Additional costs</dt>
                <dd>{formatCurrency(additionalCostTotal)}</dd>
              </div>
              <div className="total-line">
                <dt>Total production cost</dt>
                <dd>{formatCurrency(totalProductionCost)}</dd>
              </div>
              <div>
                <dt>Cost per kg</dt>
                <dd>{formatCurrency(costPerKg)}</dd>
              </div>
              <div className="total-line">
                <dt>{pricing.sellingUnit} price</dt>
                <dd>{formatCurrency(sellingPrice)}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Recipe details</h2>
              <p>Compact saved formula metadata and pricing defaults.</p>
            </div>
          </div>
          <div className="form-grid four">
            <Field label="Recipe name" required>
              <input
                value={recipe.name}
                onChange={(event) =>
                  setRecipe((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Recipe code" required>
              <input
                value={recipe.code}
                onChange={(event) =>
                  setRecipe((current) => ({ ...current, code: event.target.value }))
                }
              />
            </Field>
            <Field label="Category">
              <input
                value={recipe.category}
                onChange={(event) =>
                  setRecipe((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Status">
              <select
                value={recipe.status}
                onChange={(event) =>
                  setRecipe((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option>Draft</option>
                <option>Active</option>
                <option>Archived</option>
              </select>
            </Field>
            <Field label="Expected base yield">
              <span className="quantity-pair">
                <NumberInput
                  label="Expected base yield"
                  value={recipe.expectedYield}
                  onChange={(value) =>
                    setRecipe((current) => ({ ...current, expectedYield: value }))
                  }
                />
                <UnitSelect
                  label="Yield unit"
                  value={recipe.yieldUnit}
                  onChange={(value) =>
                    setRecipe((current) => ({ ...current, yieldUnit: value }))
                  }
                />
              </span>
            </Field>
            <Field label="Pricing method">
              <select
                value={recipe.pricingMethod}
                onChange={(event) =>
                  setRecipe((current) => ({
                    ...current,
                    pricingMethod: event.target.value,
                  }))
                }
              >
                <option>Markup</option>
                <option>Gross Margin</option>
              </select>
            </Field>
            <Field label="Default profit %">
              <NumberInput
                label="Default profit percentage"
                value={recipe.profitPercentage}
                onChange={(value) =>
                  setRecipe((current) => ({
                    ...current,
                    profitPercentage: value,
                  }))
                }
              />
            </Field>
            <Field label="Version">
              <input
                value={recipe.version}
                onChange={(event) =>
                  setRecipe((current) => ({
                    ...current,
                    version: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Description">
              <textarea
                value={recipe.description}
                onChange={(event) =>
                  setRecipe((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Recipe image">
              <input
                placeholder="Image URL or file reference"
                value={recipe.image}
                onChange={(event) =>
                  setRecipe((current) => ({ ...current, image: event.target.value }))
                }
              />
            </Field>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Formula builder</h2>
              <p>One line must be marked as the main scaling ingredient.</p>
            </div>
            <button type="button" className="compact-button" onClick={addFormulaLine}>
              + Line
            </button>
          </div>

          <div className="sheet formula-sheet" role="table" aria-label="Recipe formula lines">
            <div className="sheet-head" role="row">
              <span role="columnheader">Ingredient</span>
              <span role="columnheader">Purchase</span>
              <span role="columnheader">Base cost</span>
              <span role="columnheader">Formula qty</span>
              <span role="columnheader">Waste %</span>
              <span role="columnheader">Line cost</span>
              <span role="columnheader">Main</span>
              <span role="columnheader">Notes</span>
              <span role="columnheader">Actions</span>
            </div>
            {formulaRows.map((row) => (
              <div className="sheet-row" role="row" key={row.id}>
                <span role="cell">
                  <select
                    value={row.ingredientId}
                    onChange={(event) =>
                      updateFormulaLine(row.id, "ingredientId", event.target.value)
                    }
                    aria-label={`Ingredient for row ${row.index + 1}`}
                  >
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span role="cell" className="muted-cell">
                  {formatCurrency(row.ingredient?.purchaseCost ?? 0)} /{" "}
                  {formatNumber(row.ingredient?.purchaseQuantity ?? 0, 2)}{" "}
                  {row.ingredient?.purchaseUnit}
                </span>
                <span role="cell" className="numeric-cell">
                  {formatCurrency(row.baseCost)} / {row.ingredient?.baseUnit}
                </span>
                <span role="cell" className="quantity-pair">
                  <NumberInput
                    label={`Formula quantity for ${row.ingredient?.name}`}
                    value={row.quantity}
                    onChange={(value) => updateFormulaLine(row.id, "quantity", value)}
                  />
                  <UnitSelect
                    label={`Formula unit for ${row.ingredient?.name}`}
                    value={row.unit}
                    onChange={(value) => updateFormulaLine(row.id, "unit", value)}
                  />
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Wastage percentage for ${row.ingredient?.name}`}
                    value={row.wastage}
                    onChange={(value) => updateFormulaLine(row.id, "wastage", value)}
                  />
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatCurrency(row.lineCost)}
                </span>
                <span role="cell" className="center-cell">
                  <input
                    type="radio"
                    aria-label={`Mark ${row.ingredient?.name} as main ingredient`}
                    checked={row.isMain}
                    onChange={() => setMainFormulaLine(row.id)}
                  />
                </span>
                <span role="cell">
                  <input
                    value={row.notes}
                    onChange={(event) =>
                      updateFormulaLine(row.id, "notes", event.target.value)
                    }
                    aria-label={`Notes for ${row.ingredient?.name}`}
                  />
                </span>
                <span role="cell" className="action-cell">
                  <label className="toggle-mini" title="Optional ingredient">
                    <input
                      type="checkbox"
                      checked={row.optional}
                      onChange={(event) =>
                        updateFormulaLine(row.id, "optional", event.target.checked)
                      }
                    />
                    Opt
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Duplicate ${row.ingredient?.name}`}
                    title="Duplicate"
                    onClick={() => duplicateFormulaLine(row.id)}
                  >
                    D
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${row.ingredient?.name}`}
                    title="Delete"
                    onClick={() => removeFormulaLine(row.id)}
                  >
                    X
                  </button>
                </span>
              </div>
            ))}
            <div className="sheet-total" role="row">
              <span role="cell">Total formula cost</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" className="numeric-cell">
                {formatCurrency(totalFormulaCost)}
              </span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
            </div>
          </div>

          <div className="mobile-records" aria-label="Formula lines mobile">
            {formulaRows.map((row) => (
              <details className="sheet-record" key={row.id}>
                <summary>
                  <span>
                    <strong>{row.ingredient?.name}</strong>
                    <small>
                      {formatNumber(row.quantity, row.unit === "kg" ? 3 : 1)}{" "}
                      {row.unit}
                    </small>
                  </span>
                  <span>{formatCurrency(row.lineCost)}</span>
                </summary>
                <div className="record-grid">
                  <Field label="Quantity">
                    <span className="quantity-pair">
                      <NumberInput
                        label={`Mobile formula quantity for ${row.ingredient?.name}`}
                        value={row.quantity}
                        onChange={(value) =>
                          updateFormulaLine(row.id, "quantity", value)
                        }
                      />
                      <UnitSelect
                        label={`Mobile formula unit for ${row.ingredient?.name}`}
                        value={row.unit}
                        onChange={(value) =>
                          updateFormulaLine(row.id, "unit", value)
                        }
                      />
                    </span>
                  </Field>
                  <Field label="Wastage %">
                    <NumberInput
                      label={`Mobile wastage percentage for ${row.ingredient?.name}`}
                      value={row.wastage}
                      onChange={(value) =>
                        updateFormulaLine(row.id, "wastage", value)
                      }
                    />
                  </Field>
                  <label className="check-row">
                    <input
                      type="radio"
                      checked={row.isMain}
                      onChange={() => setMainFormulaLine(row.id)}
                    />
                    Main ingredient
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={row.optional}
                      onChange={(event) =>
                        updateFormulaLine(row.id, "optional", event.target.checked)
                      }
                    />
                    Optional
                  </label>
                  <Field label="Notes">
                    <input
                      value={row.notes}
                      onChange={(event) =>
                        updateFormulaLine(row.id, "notes", event.target.value)
                      }
                    />
                  </Field>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="panel" id="production">
          <div className="section-title">
            <div>
              <h2>Production batch</h2>
              <p>Actual quantities can override calculated required quantities.</p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={savingBatch}
              onClick={() => simulateSave("batch")}
            >
              {savingBatch ? "Saving..." : "Save batch"}
            </button>
          </div>

          <div className="form-grid four">
            <Field label="Batch number" required>
              <input
                value={production.batchNumber}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    batchNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Recipe">
              <input value={`${recipe.name} ${recipe.version}`} readOnly />
            </Field>
            <Field label="Business">
              <input
                value={production.business}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    business: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Location">
              <input
                value={production.location}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Production area">
              <input
                value={production.productionArea}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    productionArea: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Responsible employee">
              <input
                value={production.responsible}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    responsible: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Status">
              <select
                value={production.status}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="Quality rating">
              <select
                value={production.qualityRating}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    qualityRating: event.target.value,
                  }))
                }
              >
                <option value="1">1 - Poor</option>
                <option value="2">2 - Fair</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Very good</option>
                <option value="5">5 - Excellent</option>
              </select>
            </Field>
            <Field label="Start date and time">
              <input
                type="datetime-local"
                value={production.start}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    start: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="End date and time">
              <input
                type="datetime-local"
                value={production.end}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    end: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Photos">
              <input
                value={production.photos}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    photos: event.target.value,
                  }))
                }
                placeholder="Photo references"
              />
            </Field>
            <Field label="Completed by">
              <input
                value={production.completedBy}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    completedBy: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Approved by">
              <input
                value={production.approvedBy}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    approvedBy: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Pre-production notes">
              <textarea
                value={production.preNotes}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    preNotes: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="During-production notes">
              <textarea
                value={production.duringNotes}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    duringNotes: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Outcome notes">
              <textarea
                value={production.outcomeNotes}
                onChange={(event) =>
                  setProduction((current) => ({
                    ...current,
                    outcomeNotes: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div
            className="sheet production-sheet"
            role="table"
            aria-label="Production ingredients"
          >
            <div className="sheet-head" role="row">
              <span role="columnheader">Ingredient</span>
              <span role="columnheader">Required</span>
              <span role="columnheader">Actual</span>
              <span role="columnheader">Variance</span>
              <span role="columnheader">Expected cost</span>
              <span role="columnheader">Actual cost</span>
              <span role="columnheader">Cost var.</span>
              <span role="columnheader">Notes</span>
            </div>
            {productionRows.map((row) => (
              <div className="sheet-row" role="row" key={row.id}>
                <span role="cell">
                  <strong>{row.ingredient?.name}</strong>
                  {row.isMain ? <small>Main</small> : null}
                </span>
                <span role="cell" className="numeric-cell">
                  {formatNumber(row.requiredQuantity, row.unit === "kg" ? 3 : 1)}{" "}
                  {row.unit}
                </span>
                <span role="cell" className="quantity-pair">
                  <NumberInput
                    label={`Actual quantity used for ${row.ingredient?.name}`}
                    value={row.actualQuantity}
                    onChange={(value) => updateUsage(row.id, { quantity: value })}
                  />
                  <UnitSelect
                    label={`Actual unit for ${row.ingredient?.name}`}
                    value={row.actualUnit}
                    onChange={(value) => updateUsage(row.id, { unit: value })}
                  />
                </span>
                <span
                  role="cell"
                  className={`numeric-cell ${
                    Math.abs(row.variance) > 0.001 ? "warning-text" : ""
                  }`}
                >
                  {formatNumber(row.variance, row.unit === "kg" ? 3 : 1)} {row.unit}
                </span>
                <span role="cell" className="numeric-cell">
                  {formatCurrency(row.expectedCost)}
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatCurrency(row.actualCost)}
                </span>
                <span role="cell" className="numeric-cell">
                  {formatCurrency(row.costVariance)}
                </span>
                <span role="cell">
                  <input
                    value={row.usageNotes}
                    onChange={(event) =>
                      updateUsage(row.id, { notes: event.target.value })
                    }
                    aria-label={`Production notes for ${row.ingredient?.name}`}
                  />
                </span>
              </div>
            ))}
            <div className="sheet-total" role="row">
              <span role="cell">Ingredient totals</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" className="numeric-cell">
                {formatCurrency(expectedIngredientCost)}
              </span>
              <span role="cell" className="numeric-cell">
                {formatCurrency(actualIngredientCost)}
              </span>
              <span role="cell" className="numeric-cell">
                {formatCurrency(actualIngredientCost - expectedIngredientCost)}
              </span>
              <span role="cell" />
            </div>
          </div>

          <div className="mobile-records" aria-label="Production ingredients mobile">
            {productionRows.map((row) => (
              <details className="sheet-record" key={row.id}>
                <summary>
                  <span>
                    <strong>{row.ingredient?.name}</strong>
                    <small>
                      Required {formatNumber(row.requiredQuantity, 2)} {row.unit}
                    </small>
                  </span>
                  <span>{formatCurrency(row.actualCost)}</span>
                </summary>
                <div className="record-grid">
                  <Field label="Actual quantity">
                    <span className="quantity-pair">
                      <NumberInput
                        label={`Mobile actual quantity for ${row.ingredient?.name}`}
                        value={row.actualQuantity}
                        onChange={(value) => updateUsage(row.id, { quantity: value })}
                      />
                      <UnitSelect
                        label={`Mobile actual unit for ${row.ingredient?.name}`}
                        value={row.actualUnit}
                        onChange={(value) => updateUsage(row.id, { unit: value })}
                      />
                    </span>
                  </Field>
                  <div className="record-metric">
                    <span>Variance</span>
                    <strong>
                      {formatNumber(row.variance, 2)} {row.unit}
                    </strong>
                  </div>
                  <div className="record-metric">
                    <span>Expected cost</span>
                    <strong>{formatCurrency(row.expectedCost)}</strong>
                  </div>
                  <Field label="Notes">
                    <input
                      value={row.usageNotes}
                      onChange={(event) =>
                        updateUsage(row.id, { notes: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="two-column-section">
          <div className="panel">
            <div className="section-title">
              <div>
                <h2>Yield</h2>
                <p>Costing uses the final usable yield.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Starting yield">
                <span className="quantity-pair">
                  <NumberInput
                    label="Starting yield"
                    value={production.startingYield}
                    onChange={(value) =>
                      setProduction((current) => ({
                        ...current,
                        startingYield: value,
                      }))
                    }
                  />
                  <UnitSelect
                    label="Starting yield unit"
                    value={production.startingYieldUnit}
                    onChange={(value) =>
                      setProduction((current) => ({
                        ...current,
                        startingYieldUnit: value,
                      }))
                    }
                  />
                </span>
              </Field>
              <Field label="End yield">
                <span className="quantity-pair">
                  <NumberInput
                    label="End yield"
                    value={production.endYield}
                    onChange={(value) =>
                      setProduction((current) => ({ ...current, endYield: value }))
                    }
                  />
                  <UnitSelect
                    label="End yield unit"
                    value={production.endYieldUnit}
                    onChange={(value) =>
                      setProduction((current) => ({
                        ...current,
                        endYieldUnit: value,
                      }))
                    }
                  />
                </span>
              </Field>
            </div>
            <div className="metric-grid">
              <div>
                <span>Yield percentage</span>
                <strong>{formatNumber(yieldPercentage, 2)}%</strong>
              </div>
              <div>
                <span>Production loss</span>
                <strong>
                  {formatNumber(productionLoss, 3)} {production.endYieldUnit}
                </strong>
              </div>
              <div>
                <span>Loss percentage</span>
                <strong>{formatNumber(lossPercentage, 2)}%</strong>
              </div>
              <div>
                <span>Cost per kg</span>
                <strong>{formatCurrency(costPerKg)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <div>
                <h2>Pricing</h2>
                <p>Markup and gross margin use separate calculations.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Pricing method">
                <select
                  value={pricing.method}
                  onChange={(event) =>
                    setPricing((current) => ({
                      ...current,
                      method: event.target.value,
                    }))
                  }
                >
                  <option>Markup</option>
                  <option>Gross Margin</option>
                </select>
              </Field>
              <Field label="Profit %">
                <NumberInput
                  label="Pricing percentage"
                  value={pricing.percentage}
                  onChange={(value) =>
                    setPricing((current) => ({
                      ...current,
                      percentage: value,
                    }))
                  }
                />
              </Field>
              <Field label="Selling unit">
                <select
                  value={pricing.sellingUnit}
                  onChange={(event) =>
                    setPricing((current) => ({
                      ...current,
                      sellingUnit: event.target.value,
                    }))
                  }
                >
                  <option>Per kg</option>
                  <option>Per 500 g</option>
                  <option>Per 250 g</option>
                  <option>Per 100 g</option>
                  <option>Per portion</option>
                  <option>Per packet</option>
                  <option>Per item</option>
                  <option>Custom quantity</option>
                </select>
              </Field>
              <Field label="Custom quantity">
                <span className="quantity-pair">
                  <NumberInput
                    label="Custom selling quantity"
                    value={pricing.customQuantity}
                    onChange={(value) =>
                      setPricing((current) => ({
                        ...current,
                        customQuantity: value,
                      }))
                    }
                  />
                  <UnitSelect
                    label="Custom selling unit"
                    value={pricing.customUnit}
                    onChange={(value) =>
                      setPricing((current) => ({
                        ...current,
                        customUnit: value,
                      }))
                    }
                  />
                </span>
              </Field>
            </div>
            <div className="metric-grid pricing-metrics">
              <div>
                <span>Cost per selling unit</span>
                <strong>{formatCurrency(sellingUnitCost)}</strong>
              </div>
              <div>
                <span>Selling price</span>
                <strong>{formatCurrency(sellingPrice)}</strong>
              </div>
              <div>
                <span>Unit profit</span>
                <strong>{formatCurrency(unitProfit)}</strong>
              </div>
              <div>
                <span>Effective margin</span>
                <strong>{formatNumber(effectiveMargin, 2)}%</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Additional costs</h2>
              <p>Labour, utilities, packaging and overheads are included in total cost.</p>
            </div>
            <button type="button" className="compact-button" onClick={addCostLine}>
              + Cost
            </button>
          </div>
          <div className="sheet cost-sheet" role="table" aria-label="Additional costs">
            <div className="sheet-head" role="row">
              <span role="columnheader">Type</span>
              <span role="columnheader">Description</span>
              <span role="columnheader">Qty</span>
              <span role="columnheader">Rate</span>
              <span role="columnheader">Total</span>
              <span role="columnheader">Notes</span>
              <span role="columnheader">Action</span>
            </div>
            {additionalCosts.map((row) => (
              <div className="sheet-row" role="row" key={row.id}>
                <span role="cell">
                  <select
                    value={row.type}
                    onChange={(event) =>
                      setAdditionalCosts((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? { ...item, type: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {costTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </span>
                <span role="cell">
                  <input
                    value={row.description}
                    onChange={(event) =>
                      setAdditionalCosts((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Quantity for ${row.type}`}
                    value={row.quantity}
                    onChange={(value) =>
                      setAdditionalCosts((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, quantity: value } : item,
                        ),
                      )
                    }
                  />
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Rate for ${row.type}`}
                    value={row.rate}
                    onChange={(value) =>
                      setAdditionalCosts((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, rate: value } : item,
                        ),
                      )
                    }
                  />
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatCurrency(row.quantity * row.rate)}
                </span>
                <span role="cell">
                  <input
                    value={row.notes}
                    onChange={(event) =>
                      setAdditionalCosts((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? { ...item, notes: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </span>
                <span role="cell" className="action-cell">
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${row.type} cost`}
                    title="Delete"
                    onClick={() =>
                      setAdditionalCosts((current) =>
                        current.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    X
                  </button>
                </span>
              </div>
            ))}
            <div className="sheet-total" role="row">
              <span role="cell">Additional cost total</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" className="numeric-cell">
                {formatCurrency(additionalCostTotal)}
              </span>
              <span role="cell" />
              <span role="cell" />
            </div>
          </div>
        </section>

        <section className="panel" id="ingredients">
          <div className="section-title">
            <div>
              <h2>Ingredient library</h2>
              <p>Purchase costs convert automatically into recipe base unit costs.</p>
            </div>
            <button type="button" className="compact-button" onClick={addIngredient}>
              + Ingredient
            </button>
          </div>
          <div
            className="sheet ingredient-sheet"
            role="table"
            aria-label="Ingredient library"
          >
            <div className="sheet-head" role="row">
              <span role="columnheader">Ingredient</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Purchase qty</span>
              <span role="columnheader">Cost</span>
              <span role="columnheader">Base unit</span>
              <span role="columnheader">Cost/base</span>
              <span role="columnheader">Supplier</span>
              <span role="columnheader">SKU</span>
              <span role="columnheader">Active</span>
            </div>
            {ingredients.map((ingredient) => (
              <div className="sheet-row" role="row" key={ingredient.id}>
                <span role="cell">
                  <input
                    value={ingredient.name}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, "name", event.target.value)
                    }
                  />
                </span>
                <span role="cell">
                  <input
                    value={ingredient.category}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, "category", event.target.value)
                    }
                  />
                </span>
                <span role="cell" className="quantity-pair">
                  <NumberInput
                    label={`Purchase quantity for ${ingredient.name}`}
                    value={ingredient.purchaseQuantity}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, "purchaseQuantity", value)
                    }
                  />
                  <UnitSelect
                    label={`Purchase unit for ${ingredient.name}`}
                    value={ingredient.purchaseUnit}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, "purchaseUnit", value)
                    }
                  />
                </span>
                <span role="cell">
                  <NumberInput
                    label={`Purchase cost for ${ingredient.name}`}
                    value={ingredient.purchaseCost}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, "purchaseCost", value)
                    }
                  />
                </span>
                <span role="cell">
                  <UnitSelect
                    label={`Recipe base unit for ${ingredient.name}`}
                    value={ingredient.baseUnit}
                    onChange={(value) =>
                      updateIngredient(ingredient.id, "baseUnit", value)
                    }
                  />
                </span>
                <span role="cell" className="numeric-cell strong-cell">
                  {formatCurrency(ingredientBaseCost(ingredient))} /{" "}
                  {ingredient.baseUnit}
                </span>
                <span role="cell">
                  <input
                    value={ingredient.supplier}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, "supplier", event.target.value)
                    }
                  />
                </span>
                <span role="cell">
                  <input
                    value={ingredient.sku}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, "sku", event.target.value)
                    }
                  />
                </span>
                <span role="cell" className="center-cell">
                  <input
                    type="checkbox"
                    checked={ingredient.active}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, "active", event.target.checked)
                    }
                    aria-label={`${ingredient.name} active status`}
                  />
                </span>
              </div>
            ))}
          </div>

          <div className="mobile-records" aria-label="Ingredient library mobile">
            {ingredients.map((ingredient) => (
              <details className="sheet-record" key={ingredient.id}>
                <summary>
                  <span>
                    <strong>{ingredient.name}</strong>
                    <small>{ingredient.category}</small>
                  </span>
                  <span>
                    {formatCurrency(ingredientBaseCost(ingredient))} /{" "}
                    {ingredient.baseUnit}
                  </span>
                </summary>
                <div className="record-grid">
                  <Field label="Purchase">
                    <span className="quantity-pair">
                      <NumberInput
                        label={`Mobile purchase quantity for ${ingredient.name}`}
                        value={ingredient.purchaseQuantity}
                        onChange={(value) =>
                          updateIngredient(
                            ingredient.id,
                            "purchaseQuantity",
                            value,
                          )
                        }
                      />
                      <UnitSelect
                        label={`Mobile purchase unit for ${ingredient.name}`}
                        value={ingredient.purchaseUnit}
                        onChange={(value) =>
                          updateIngredient(ingredient.id, "purchaseUnit", value)
                        }
                      />
                    </span>
                  </Field>
                  <Field label="Supplier">
                    <input
                      value={ingredient.supplier}
                      onChange={(event) =>
                        updateIngredient(
                          ingredient.id,
                          "supplier",
                          event.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="SKU">
                    <input
                      value={ingredient.sku}
                      onChange={(event) =>
                        updateIngredient(ingredient.id, "sku", event.target.value)
                      }
                    />
                  </Field>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={ingredient.active}
                      onChange={(event) =>
                        updateIngredient(
                          ingredient.id,
                          "active",
                          event.target.checked,
                        )
                      }
                    />
                    Active
                  </label>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="panel" id="method">
          <div className="section-title">
            <div>
              <h2>Production method</h2>
              <p>Drag steps to reorder, or use the compact move controls.</p>
            </div>
            <button
              type="button"
              className="compact-button"
              onClick={() =>
                setMethodSteps((current) => [
                  ...current,
                  {
                    id: makeId("step"),
                    title: "New step",
                    instructions: "",
                    duration: "",
                    temperature: "",
                    equipment: "",
                    image: "",
                    notes: "",
                  },
                ])
              }
            >
              + Step
            </button>
          </div>
          <div className="method-list">
            {methodSteps.map((step, index) => (
              <article
                className="method-step"
                key={step.id}
                draggable
                onDragStart={(event: DragEvent<HTMLElement>) => {
                  setDraggingStepId(step.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
                onDrop={() => dropStep(step.id)}
              >
                <div className="step-index">{index + 1}</div>
                <div className="method-fields">
                  <div className="form-grid four">
                    <Field label="Step title">
                      <input
                        value={step.title}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Duration">
                      <input
                        value={step.duration}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, duration: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Temperature">
                      <input
                        value={step.temperature}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, temperature: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Equipment">
                      <input
                        value={step.equipment}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, equipment: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Instructions">
                      <textarea
                        value={step.instructions}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, instructions: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Image">
                      <input
                        value={step.image}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, image: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Notes">
                      <input
                        value={step.notes}
                        onChange={(event) =>
                          setMethodSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, notes: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                </div>
                <div className="step-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${step.title} up`}
                    title="Move up"
                    onClick={() => moveStep(step.id, -1)}
                  >
                    ^
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${step.title} down`}
                    title="Move down"
                    onClick={() => moveStep(step.id, 1)}
                  >
                    v
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${step.title}`}
                    title="Delete"
                    onClick={() =>
                      setMethodSteps((current) =>
                        current.filter((item) => item.id !== step.id),
                      )
                    }
                  >
                    X
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" id="reports">
          <div className="section-title">
            <div>
              <h2>Reports</h2>
              <p>Compact views for yield, costing and profitability review.</p>
            </div>
          </div>
          <div className="report-grid">
            <div className="report-cell">
              <span>Total cost</span>
              <strong>{formatCurrency(totalProductionCost)}</strong>
              <small>Ingredients plus additional production costs.</small>
            </div>
            <div className="report-cell">
              <span>Final usable yield</span>
              <strong>
                {formatNumber(production.endYield, 3)} {production.endYieldUnit}
              </strong>
              <small>Costing is based on end yield.</small>
            </div>
            <div className="report-cell">
              <span>Cost variance</span>
              <strong>
                {formatCurrency(actualIngredientCost - expectedIngredientCost)}
              </strong>
              <small>Actual ingredient cost against scaled expected cost.</small>
            </div>
            <div className="report-cell">
              <span>Suggested price</span>
              <strong>{formatCurrency(sellingPrice)}</strong>
              <small>
                {pricing.method} at {formatNumber(pricing.percentage, 1)}%.
              </small>
            </div>
          </div>
        </section>

        <div className="action-strip" aria-label="Sticky actions">
          <span>
            {recipe.code} / {production.batchNumber}
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              showToast(
                yieldPercentage >= 80 ? "success" : "warning",
                yieldPercentage >= 80
                  ? "Batch calculations are ready for review."
                  : "Yield is below the expected threshold.",
              )
            }
          >
            Review totals
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={savingRecipe || savingBatch}
            onClick={() => simulateSave("batch")}
          >
            Complete
          </button>
        </div>
      </section>
    </main>
  );
}
