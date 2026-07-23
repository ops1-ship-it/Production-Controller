"use client";

import { useEffect, useMemo, useState } from "react";

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

const storageKey = "recipe-cost-calculator:v2-application-data";

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

const initialIngredients: Ingredient[] = [
  {
    id: "silverside",
    name: "Silverside",
    category: "Meat",
    description: "Trimmed beef cut used as the primary scaling ingredient.",
    supplier: "Karoo Butchery",
    sku: "MEAT-SILV-5KG",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    purchaseCost: 132.5,
    baseUnit: "g",
    defaultWastage: 0,
    notes: "Use chilled and trimmed.",
    active: true,
    lastCostUpdate: "23 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "23 Jul 2026",
  },
  {
    id: "coarse-salt",
    name: "Coarse Salt",
    category: "Seasoning",
    description: "Food-grade coarse curing salt.",
    supplier: "Cape Dry Goods",
    sku: "DRY-SALT-10KG",
    purchaseQuantity: 10,
    purchaseUnit: "kg",
    purchaseCost: 122.5,
    baseUnit: "g",
    defaultWastage: 0,
    notes: "Store sealed.",
    active: true,
    lastCostUpdate: "20 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "20 Jul 2026",
  },
  {
    id: "coriander",
    name: "Whole Coriander",
    category: "Spice",
    description: "Whole seed coriander for toasted spice blends.",
    supplier: "Spice Route",
    sku: "SPC-CORI-1KG",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    purchaseCost: 145,
    baseUnit: "g",
    defaultWastage: 2,
    notes: "Toast before cracking.",
    active: true,
    lastCostUpdate: "20 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "20 Jul 2026",
  },
  {
    id: "black-pepper",
    name: "Coarse Black Pepper",
    category: "Spice",
    description: "Coarse milled pepper for curing mixes.",
    supplier: "Spice Route",
    sku: "SPC-PEPP-1KG",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    purchaseCost: 190,
    baseUnit: "g",
    defaultWastage: 0,
    notes: "Use fresh stock.",
    active: true,
    lastCostUpdate: "20 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "20 Jul 2026",
  },
  {
    id: "vinegar",
    name: "Brown Vinegar",
    category: "Liquid",
    description: "Brown vinegar used in marinades and curing dips.",
    supplier: "Pantry Wholesale",
    sku: "LIQ-VINE-5L",
    purchaseQuantity: 5,
    purchaseUnit: "L",
    purchaseCost: 88,
    baseUnit: "ml",
    defaultWastage: 0,
    notes: "Standard brown vinegar.",
    active: true,
    lastCostUpdate: "21 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "21 Jul 2026",
  },
  {
    id: "bicarb",
    name: "Bicarbonate of Soda",
    category: "Additive",
    description: "Fine bicarbonate of soda powder.",
    supplier: "Cape Dry Goods",
    sku: "ADD-BIC-500G",
    purchaseQuantity: 500,
    purchaseUnit: "g",
    purchaseCost: 36,
    baseUnit: "g",
    defaultWastage: 0,
    notes: "Use sparingly.",
    active: true,
    lastCostUpdate: "19 Jul 2026",
    createdAt: "18 Jul 2026",
    updatedAt: "19 Jul 2026",
  },
];

const baseFormula: FormulaLine[] = [
  {
    id: "line-silverside",
    ingredientId: "silverside",
    quantity: 1,
    unit: "kg",
    isMain: true,
    optional: false,
    wastage: 0,
    notes: "Scaling ingredient",
    sortOrder: 1,
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
    sortOrder: 2,
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
    sortOrder: 3,
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
    sortOrder: 4,
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
    sortOrder: 5,
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
    sortOrder: 6,
  },
];

const baseMethod: MethodStep[] = [
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

const initialRecipes: Recipe[] = [
  {
    id: "recipe-silverside",
    name: "Traditional Silverside Biltong",
    code: "BEEF-SILV-001",
    category: "Cured Meat",
    description: "A base biltong-style formula with immediate batch scaling.",
    version: "1.0",
    status: "Active",
    baseStartingQuantity: 1,
    baseStartingUnit: "kg",
    expectedYield: 0.9,
    yieldUnit: "kg",
    defaultAdditionalCost: 24,
    defaultSellingUnit: "Per kg",
    pricingMethod: "Gross Margin",
    pricingPercentage: 42,
    methodIntro: "Keep the meat chilled and record all trim and yield changes.",
    image: "",
    updatedAt: "23 Jul 2026, 09:42",
    formulaLines: baseFormula,
    methodSteps: baseMethod,
  },
  {
    id: "recipe-biltong",
    name: "Coriander Biltong Slab",
    code: "BEEF-BILT-002",
    category: "Dried Meat",
    description: "Leaner slabs with heavier coriander and a longer dry stage.",
    version: "1.2",
    status: "Active",
    baseStartingQuantity: 1,
    baseStartingUnit: "kg",
    expectedYield: 0.62,
    yieldUnit: "kg",
    defaultAdditionalCost: 32,
    defaultSellingUnit: "Per 100 g",
    pricingMethod: "Gross Margin",
    pricingPercentage: 48,
    methodIntro: "Cut even slabs and dry until the target moisture loss is reached.",
    image: "",
    updatedAt: "22 Jul 2026, 15:18",
    formulaLines: [
      { ...baseFormula[0], id: "biltong-silverside", notes: "Trim lean" },
      { ...baseFormula[1], id: "biltong-salt", quantity: 24 },
      {
        ...baseFormula[2],
        id: "biltong-coriander",
        quantity: 18,
        wastage: 3,
        notes: "Toasted and cracked",
      },
      { ...baseFormula[3], id: "biltong-pepper", quantity: 5 },
      {
        ...baseFormula[4],
        id: "biltong-vinegar",
        quantity: 120,
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
    description: "Thin-cut jerky batch with a higher vinegar marinade ratio.",
    version: "0.8",
    status: "Draft",
    baseStartingQuantity: 1,
    baseStartingUnit: "kg",
    expectedYield: 0.52,
    yieldUnit: "kg",
    defaultAdditionalCost: 28,
    defaultSellingUnit: "Per packet",
    pricingMethod: "Markup",
    pricingPercentage: 75,
    methodIntro: "Slice evenly and marinate before drying.",
    image: "",
    updatedAt: "21 Jul 2026, 11:05",
    formulaLines: [
      { ...baseFormula[0], id: "jerky-silverside", notes: "Slice thin" },
      {
        ...baseFormula[4],
        id: "jerky-vinegar",
        quantity: 220,
        sortOrder: 2,
        notes: "Marinade",
      },
      { ...baseFormula[1], id: "jerky-salt", quantity: 18, sortOrder: 3 },
      { ...baseFormula[3], id: "jerky-pepper", quantity: 8, sortOrder: 4 },
      {
        ...baseFormula[2],
        id: "jerky-coriander",
        quantity: 6,
        optional: true,
        sortOrder: 5,
        notes: "Optional",
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

function formatCurrency(value: number, digits = 2) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
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

function cloneFormula(lines: FormulaLine[]) {
  return lines.map((line) => ({ ...line }));
}

function cloneMethod(steps: MethodStep[]) {
  return steps.map((step) => ({ ...step }));
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

const completedDemoProduction: ProductionBatch = {
  id: "production-completed-001",
  batchNumber: "PB-2026-0000",
  recipeId: "recipe-silverside",
  recipeName: "Traditional Silverside Biltong",
  recipeVersion: "1.0",
  status: "Completed",
  mainQuantity: 1.5,
  mainUnit: "kg",
  startDate: "2026-07-20T08:00",
  endDate: "2026-07-22T11:00",
  responsible: "A. Carstens",
  location: "Cape Town",
  expectedCompletion: "2026-07-22T08:00",
  notes: "Completed with normal drying loss.",
  outcomeNotes: "Good texture and even cure.",
  completedBy: "A. Carstens",
  qualityRating: "4",
  startingYield: 1.5,
  completedYield: 0.9,
  yieldUnit: "kg",
  methodSnapshot: cloneMethod(baseMethod),
  formulaSnapshot: cloneFormula(baseFormula),
  lines: [],
  additionalCosts: [
    {
      id: "completed-cost-labour",
      type: "Labour",
      description: "Preparation and packing",
      quantity: 1.5,
      rate: 85,
      notes: "",
    },
  ],
  finalTotalCost: 250,
  finalCostPerYield: 277.78,
  finalSellingPrice: 478.93,
};

const initialData: AppData = {
  ingredients: initialIngredients,
  recipes: initialRecipes,
  productions: [completedDemoProduction],
};

export default function RecipeCostApp({
  initialPath = "/dashboard",
}: {
  initialPath?: string;
}) {
  const [route, setRoute] = useState(initialPath);
  const [ingredients, setIngredients] = useState(initialData.ingredients);
  const [recipes, setRecipes] = useState(initialData.recipes);
  const [productions, setProductions] = useState(initialData.productions);
  const [activeRecipeId, setActiveRecipeId] = useState("recipe-silverside");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [toast, setToast] = useState<Toast | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [startingProduction, setStartingProduction] = useState(false);
  const [productionDraft, setProductionDraft] = useState({
    recipeId: "recipe-silverside",
    mainQuantity: 1.5,
    mainUnit: "kg" as Unit,
    startDate: "2026-07-23T08:00",
    responsible: "A. Carstens",
    location: "Cape Town",
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
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<AppData>;
      if (parsed.ingredients?.length) setIngredients(parsed.ingredients);
      if (parsed.recipes?.length) setRecipes(parsed.recipes);
      if (parsed.productions?.length) setProductions(parsed.productions);
    } catch {
      setToast({
        kind: "warning",
        message: "Saved local application data could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ingredients, recipes, productions }),
    );
  }, [ingredients, productions, recipes]);

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
    recipes.find((recipe) => recipe.id === activeRecipeId) ?? recipes[0];
  const selectedProductionRecipe =
    recipes.find((recipe) => recipe.id === productionDraft.recipeId) ??
    activeRecipe;

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

  const productionDraftLines = useMemo(
    () =>
      productionLinesForRecipe(
        selectedProductionRecipe,
        productionDraft.mainQuantity,
        productionDraft.mainUnit,
        ingredientMap,
      ),
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
    window.history.pushState(null, "", href);
    setRoute(`${window.location.pathname}${window.location.search}`);
  };

  const showToast = (kind: Toast["kind"], message: string) => {
    setToast({ kind, message });
  };

  const updateIngredient = (id: string, patch: Partial<Ingredient>) => {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id
          ? { ...ingredient, ...patch, updatedAt: "23 Jul 2026" }
          : ingredient,
      ),
    );
  };

  const createIngredient = () => {
    const ingredient: Ingredient = {
      id: makeId("ingredient"),
      name: "New Ingredient",
      category: "Uncategorised",
      description: "",
      supplier: "",
      sku: "",
      purchaseQuantity: 1,
      purchaseUnit: "kg",
      purchaseCost: 0,
      baseUnit: "kg",
      defaultWastage: 0,
      notes: "",
      active: true,
      lastCostUpdate: "23 Jul 2026",
      createdAt: "23 Jul 2026",
      updatedAt: "23 Jul 2026",
    };
    setIngredients((current) => [ingredient, ...current]);
    showToast("success", "Ingredient created.");
  };

  const duplicateIngredient = (ingredient: Ingredient) => {
    setIngredients((current) => [
      {
        ...ingredient,
        id: makeId("ingredient"),
        name: `${ingredient.name} copy`,
        sku: `${ingredient.sku}-COPY`,
        createdAt: "23 Jul 2026",
        updatedAt: "23 Jul 2026",
      },
      ...current,
    ]);
    showToast("success", "Ingredient duplicated.");
  };

  const archiveIngredient = (id: string) => {
    updateIngredient(id, { active: false });
    showToast("warning", "Ingredient archived.");
  };

  const updateRecipe = (recipeId: string, patch: Partial<Recipe>) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? { ...recipe, ...patch, updatedAt: todayStamp() }
          : recipe,
      ),
    );
  };

  const updateFormulaLine = (
    recipeId: string,
    lineId: string,
    patch: Partial<FormulaLine>,
  ) => {
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
  };

  const setMainFormulaLine = (recipeId: string, lineId: string) => {
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
  };

  const addFormulaLine = (recipeId: string) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              formulaLines: [
                ...recipe.formulaLines,
                {
                  id: makeId("formula"),
                  ingredientId:
                    ingredients.find((ingredient) => ingredient.active)?.id ?? "",
                  quantity: 1,
                  unit: "g",
                  isMain: recipe.formulaLines.length === 0,
                  optional: false,
                  wastage: 0,
                  notes: "",
                  sortOrder: recipe.formulaLines.length + 1,
                },
              ],
            }
          : recipe,
      ),
    );
  };

  const removeFormulaLine = (recipeId: string, lineId: string) => {
    setRecipes((current) =>
      current.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;
        const nextLines = recipe.formulaLines.filter((line) => line.id !== lineId);
        const hasMain = nextLines.some((line) => line.isMain);
        return {
          ...recipe,
          formulaLines: nextLines.map((line, index) => ({
            ...line,
            isMain: hasMain ? line.isMain : index === 0,
            sortOrder: index + 1,
          })),
        };
      }),
    );
  };

  const moveMethodStep = (recipeId: string, stepId: string, direction: -1 | 1) => {
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
        return { ...recipe, methodSteps: nextSteps };
      }),
    );
  };

  const updateMethodStep = (
    recipeId: string,
    stepId: string,
    patch: Partial<MethodStep>,
  ) => {
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
  };

  const addMethodStep = (recipeId: string) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              updatedAt: todayStamp(),
              methodSteps: [
                ...recipe.methodSteps,
                {
                  id: makeId("step"),
                  title: "New method step",
                  instructions: "",
                  duration: "",
                  temperature: "",
                  equipment: "",
                  image: "",
                  notes: "",
                },
              ],
            }
          : recipe,
      ),
    );
  };

  const removeMethodStep = (recipeId: string, stepId: string) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              updatedAt: todayStamp(),
              methodSteps: recipe.methodSteps.filter((step) => step.id !== stepId),
            }
          : recipe,
      ),
    );
  };

  const createRecipe = () => {
    const firstIngredient =
      ingredients.find((ingredient) => ingredient.active)?.id ?? "silverside";
    const recipe: Recipe = {
      id: makeId("recipe"),
      name: "Untitled Recipe",
      code: `REC-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      category: "New",
      description: "",
      version: "0.1",
      status: "Draft",
      baseStartingQuantity: 1,
      baseStartingUnit: "kg",
      expectedYield: 1,
      yieldUnit: "kg",
      defaultAdditionalCost: 0,
      defaultSellingUnit: "Per kg",
      pricingMethod: "Gross Margin",
      pricingPercentage: 40,
      methodIntro: "",
      image: "",
      updatedAt: todayStamp(),
      formulaLines: [
        {
          id: makeId("formula"),
          ingredientId: firstIngredient,
          quantity: 1,
          unit: "kg",
          isMain: true,
          optional: false,
          wastage: 0,
          notes: "Scaling ingredient",
          sortOrder: 1,
        },
      ],
      methodSteps: [],
    };
    setRecipes((current) => [recipe, ...current]);
    setActiveRecipeId(recipe.id);
    navigate(`/recipes/${recipe.id}/edit`);
  };

  const duplicateRecipe = (recipe: Recipe) => {
    const duplicate = {
      ...recipe,
      id: makeId("recipe"),
      name: `${recipe.name} copy`,
      code: `${recipe.code}-COPY`,
      status: "Draft" as const,
      updatedAt: todayStamp(),
      formulaLines: cloneFormula(recipe.formulaLines).map((line) => ({
        ...line,
        id: makeId("formula"),
      })),
      methodSteps: cloneMethod(recipe.methodSteps).map((step) => ({
        ...step,
        id: makeId("step"),
      })),
    };
    setRecipes((current) => [duplicate, ...current]);
    showToast("success", "Recipe duplicated.");
  };

  const archiveRecipe = (recipeId: string) => {
    updateRecipe(recipeId, { status: "Archived" });
    showToast("warning", "Recipe archived.");
  };

  const deleteRecipe = (recipeId: string) => {
    const fallbackRecipe = recipes.find((recipe) => recipe.id !== recipeId);
    if (!fallbackRecipe) {
      showToast("failed", "Keep at least one recipe in the library.");
      return;
    }
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    if (activeRecipeId === recipeId) {
      setActiveRecipeId(fallbackRecipe.id);
    }
    if (productionDraft.recipeId === recipeId) {
      setProductionDraft((current) => ({ ...current, recipeId: fallbackRecipe.id }));
    }
    showToast("warning", "Recipe deleted.");
  };

  const startProduction = () => {
    if (startingProduction) return;
    setStartingProduction(true);
    const recipe = selectedProductionRecipe;
    const lines = productionLinesForRecipe(
      recipe,
      productionDraft.mainQuantity,
      productionDraft.mainUnit,
      ingredientMap,
    );
    const production: ProductionBatch = {
      id: makeId("production"),
      batchNumber: `PB-${Date.now().toString(36).slice(-6).toUpperCase()}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeVersion: recipe.version,
      status: "In Progress",
      mainQuantity: productionDraft.mainQuantity,
      mainUnit: productionDraft.mainUnit,
      startDate: productionDraft.startDate,
      endDate: "",
      responsible: productionDraft.responsible,
      location: productionDraft.location,
      expectedCompletion: "2026-07-24T08:00",
      notes: productionDraft.notes,
      outcomeNotes: "",
      completedBy: "",
      qualityRating: "",
      startingYield: productionDraft.mainQuantity,
      completedYield: 0,
      yieldUnit: productionDraft.mainUnit,
      methodSnapshot: cloneMethod(recipe.methodSteps),
      formulaSnapshot: cloneFormula(recipe.formulaLines),
      lines,
      additionalCosts: [
        {
          id: makeId("cost"),
          type: "Labour",
          description: "Production labour",
          quantity: 1,
          rate: 85,
          notes: "",
        },
      ],
    };
    setProductions((current) => [production, ...current]);
    window.setTimeout(() => {
      setStartingProduction(false);
      showToast("success", "Production started.");
      navigate(`/productions/${production.id}`);
    }, 500);
  };

  const updateProduction = (id: string, patch: Partial<ProductionBatch>) => {
    setProductions((current) =>
      current.map((production) =>
        production.id === id ? { ...production, ...patch } : production,
      ),
    );
  };

  const updateProductionLine = (
    productionId: string,
    lineId: string,
    patch: Partial<ProductionLine>,
  ) => {
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

    const ingredientCost = production.lines.reduce(
      (sum, line) => sum + line.actualCost,
      0,
    );
    const additionalCost = production.additionalCosts.reduce(
      (sum, cost) => sum + cost.quantity * cost.rate,
      0,
    );
    const totalCost = ingredientCost + additionalCost;
    const costPerYield =
      production.completedYield > 0 ? totalCost / production.completedYield : 0;
    const recipe = recipes.find((item) => item.id === production.recipeId);
    const unitCost = costPerYield * sellingUnitQuantity(recipe?.defaultSellingUnit ?? "Per kg");
    const finalSellingPrice = sellingPrice(
      unitCost,
      recipe?.pricingMethod ?? "Gross Margin",
      recipe?.pricingPercentage ?? 40,
    );

    updateProduction(production.id, {
      status: "Completed",
      finalTotalCost: totalCost,
      finalCostPerYield: costPerYield,
      finalSellingPrice,
    });
    showToast("success", "Production completed.");
    navigate("/productions/completed");
  };

  const pageTitle = pageTitleForPath(pathname);

  return (
    <main className="app-shell">
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

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Recipe Cost Calculator</p>
            <h1>{pageTitle.title}</h1>
            <p>{pageTitle.description}</p>
          </div>
          <div className="topbar-actions" aria-label="Primary actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => navigate("/productions/new")}
            >
              New Production
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={createRecipe}
            >
              New Recipe
            </button>
          </div>
        </header>

        {pathname === "/" || pathname === "/dashboard"
          ? renderDashboard()
          : pathname === "/ingredients"
            ? renderIngredientsBible()
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
            ["I", "Ingredients Bible", "/ingredients"],
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
              <strong>{formatCurrency(ingredientValue)}</strong>
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

  function renderIngredientsBible() {
    const categories = ["All", ...Array.from(new Set(ingredients.map((item) => item.category)))];
    const suppliers = ["All", ...Array.from(new Set(ingredients.map((item) => item.supplier)))];
    return (
      <section className="page-stack">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Ingredients Bible</h2>
              <p>Central ingredient library used by all recipe formula lines.</p>
            </div>
            <button type="button" className="compact-button" onClick={createIngredient}>
              + Ingredient
            </button>
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
          <div className="sheet ingredient-bible-sheet" role="table">
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
                  {formatCurrency(ingredientUnitCost(ingredient), 4)}
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
          </div>
          <div className="mobile-records">
            {filteredIngredients.map((ingredient) => (
              <details className="sheet-record" key={ingredient.id}>
                <summary>
                  <span>
                    <strong>{ingredient.name}</strong>
                    <small>{ingredient.supplier} / {ingredient.sku}</small>
                  </span>
                  <span>{formatCurrency(ingredientUnitCost(ingredient), 4)}</span>
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
          </div>
        </section>
      </section>
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
                    {formatCurrency(recipe.formulaCost)}
                  </span>
                  <span role="cell" className="numeric-cell">
                    {formatCurrency(recipe.costPerYield)}
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
                  <span>{formatCurrency(recipe.costPerYield)}</span>
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
              <p>Formula lines select linked records from the Ingredients Bible.</p>
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
                      {formatCurrency(ingredient ? ingredientUnitCost(ingredient) : 0, 4)} /{" "}
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
                      {formatCurrency(formulaLineCost(line, ingredientMap))}
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
              <span role="cell" className="numeric-cell">{formatCurrency(formulaCost)}</span>
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
              <div><span>Expected total cost</span><strong>{formatCurrency(expectedTotal)}</strong></div>
              <div><span>Cost per yield unit</span><strong>{formatCurrency(costPerYield)}</strong></div>
              <div><span>Default selling unit</span><strong>{recipe.defaultSellingUnit}</strong></div>
              <div><span>Expected selling price</span><strong>{formatCurrency(estimatedPrice)}</strong></div>
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
              <span role="cell" className="numeric-cell">{formatCurrency(line.expectedCost)}</span>
              <span role="cell" className="numeric-cell strong-cell">{formatCurrency(line.actualCost)}</span>
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
            <div><span>Ingredient cost</span><strong>{formatCurrency(ingredientCost)}</strong></div>
            <div><span>Additional cost</span><strong>{formatCurrency(additionalCost)}</strong></div>
            <div><span>Current total</span><strong>{formatCurrency(ingredientCost + additionalCost)}</strong></div>
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
                  <span role="cell" className="numeric-cell strong-cell">{formatCurrency(production.finalTotalCost ?? 0)}</span>
                  <span role="cell" className="numeric-cell">{formatCurrency(production.finalCostPerYield ?? 0)}</span>
                  <span role="cell" className="numeric-cell">{formatCurrency(production.finalSellingPrice ?? 0)}</span>
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
            <div className="report-cell"><span>Completed cost</span><strong>{formatCurrency(totalCompletedCost)}</strong><small>Actual completed production costs.</small></div>
            <div className="report-cell"><span>Average cost per kg</span><strong>{formatCurrency(completedProductions[0]?.finalCostPerYield ?? 0)}</strong><small>Uses completed yield.</small></div>
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
      title: "Ingredients Bible",
      description: "Maintain linked ingredients and purchase-cost calculations.",
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
