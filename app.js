const STORAGE_KEY = "trade-matrix-builder-state-v1";
const MAX_RENDERED_ROWS = 500;
const SCENARIO_WARNING_THRESHOLD = 10000;
const HISTORY_LIMIT = 40;

const exampleState = {
  variables: [
    { id: crypto.randomUUID(), name: "Sensor Package", valuesText: "Baseline\nEnhanced\nPassive" },
    { id: crypto.randomUUID(), name: "Flight Profile", valuesText: "Low\nMedium\nHigh" },
    { id: crypto.randomUUID(), name: "Weather", valuesText: "Clear\nRain\nDust" },
    { id: crypto.randomUUID(), name: "Comms Mode", valuesText: "Open\nEncrypted\nSilent" }
  ],
  rules: [],
  exclusions: []
};

exampleState.rules = [
  {
    id: crypto.randomUUID(),
    sourceId: exampleState.variables[0].id,
    sourceValue: "Passive",
    targetId: exampleState.variables[3].id,
    allowedValues: ["Silent"]
  },
  {
    id: crypto.randomUUID(),
    sourceId: exampleState.variables[2].id,
    sourceValue: "Dust",
    targetId: exampleState.variables[1].id,
    allowedValues: ["Medium", "High"]
  }
];

let state = loadState() || structuredClone(exampleState);
let undoStack = [];
let redoStack = [];

const elements = {
  variablesList: document.querySelector("#variablesList"),
  rulesList: document.querySelector("#rulesList"),
  exclusionsList: document.querySelector("#exclusionsList"),
  variableTemplate: document.querySelector("#variableTemplate"),
  ruleTemplate: document.querySelector("#ruleTemplate"),
  exclusionTemplate: document.querySelector("#exclusionTemplate"),
  importPanel: document.querySelector("#importPanel"),
  importText: document.querySelector("#importText"),
  importFile: document.querySelector("#importFile"),
  importFeedback: document.querySelector("#importFeedback"),
  toggleImportButton: document.querySelector("#toggleImportButton"),
  importReplaceButton: document.querySelector("#importReplaceButton"),
  importMergeButton: document.querySelector("#importMergeButton"),
  clearImportButton: document.querySelector("#clearImportButton"),
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  loadProjectFile: document.querySelector("#loadProjectFile"),
  toggleValidationButton: document.querySelector("#toggleValidationButton"),
  validationBody: document.querySelector("#validationBody"),
  validationList: document.querySelector("#validationList"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  variableSearch: document.querySelector("#variableSearch"),
  dependencySearch: document.querySelector("#dependencySearch"),
  exclusionSearch: document.querySelector("#exclusionSearch"),
  bulkVariablesText: document.querySelector("#bulkVariablesText"),
  loadBulkVariablesButton: document.querySelector("#loadBulkVariablesButton"),
  applyBulkVariablesButton: document.querySelector("#applyBulkVariablesButton"),
  exclusionImportText: document.querySelector("#exclusionImportText"),
  importExclusionsButton: document.querySelector("#importExclusionsButton"),
  addVariableButton: document.querySelector("#addVariableButton"),
  addRuleButton: document.querySelector("#addRuleButton"),
  addExclusionButton: document.querySelector("#addExclusionButton"),
  loadExampleButton: document.querySelector("#loadExampleButton"),
  resetButton: document.querySelector("#resetButton"),
  exportButton: document.querySelector("#exportButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
  scenarioFilter: document.querySelector("#scenarioFilter"),
  scenarioPattern: document.querySelector("#scenarioPattern"),
  columnOrderText: document.querySelector("#columnOrderText"),
  columnOrderBody: document.querySelector("#columnOrderBody"),
  toggleColumnOrderButton: document.querySelector("#toggleColumnOrderButton"),
  columnPresetName: document.querySelector("#columnPresetName"),
  columnPresetSelect: document.querySelector("#columnPresetSelect"),
  saveColumnPresetButton: document.querySelector("#saveColumnPresetButton"),
  loadColumnPresetButton: document.querySelector("#loadColumnPresetButton"),
  duplicateList: document.querySelector("#duplicateList"),
  matrixTable: document.querySelector("#matrixTable"),
  statusText: document.querySelector("#statusText"),
  variableCount: document.querySelector("#variableCount"),
  rawCombinationCount: document.querySelector("#rawCombinationCount"),
  validScenarioCount: document.querySelector("#validScenarioCount"),
  ruleCount: document.querySelector("#ruleCount"),
  exclusionCount: document.querySelector("#exclusionCount"),
  validationCount: document.querySelector("#validationCount")
};

elements.toggleImportButton.addEventListener("click", () => {
  elements.importPanel.hidden = !elements.importPanel.hidden;
});

elements.importFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  elements.importText.value = await file.text();
  setImportFeedback(`Loaded ${file.name}.`);
});

elements.importReplaceButton.addEventListener("click", () => importVariables({ merge: false }));
elements.importMergeButton.addEventListener("click", () => importVariables({ merge: true }));
elements.clearImportButton.addEventListener("click", () => {
  elements.importText.value = "";
  elements.importFile.value = "";
  setImportFeedback("");
});

elements.undoButton.addEventListener("click", undoChange);
elements.redoButton.addEventListener("click", redoChange);
elements.saveProjectButton.addEventListener("click", saveProjectFile);
elements.loadProjectFile.addEventListener("change", loadProjectFile);
elements.toggleValidationButton.addEventListener("click", () => {
  const isExpanded = elements.toggleValidationButton.getAttribute("aria-expanded") === "true";
  setValidationExpanded(!isExpanded);
});

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

elements.variableSearch.addEventListener("input", renderVariables);
elements.dependencySearch.addEventListener("input", renderRules);
elements.exclusionSearch.addEventListener("input", renderExclusions);
elements.loadBulkVariablesButton.addEventListener("click", loadBulkVariables);
elements.applyBulkVariablesButton.addEventListener("click", applyBulkVariables);
elements.importExclusionsButton.addEventListener("click", importExclusions);

elements.addVariableButton.addEventListener("click", () => {
  recordHistory();
  state.variables.push({
    id: crypto.randomUUID(),
    name: `Variable ${state.variables.length + 1}`,
    valuesText: "Option A\nOption B"
  });
  render();
});

elements.addRuleButton.addEventListener("click", () => {
  const source = firstVariableWithValues();

  if (!source) {
    return;
  }

  recordHistory();
  state.rules.push({
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceValue: parseValues(source)[0],
    targetId: "",
    targetName: "",
    allowedValues: []
  });
  render();
});

elements.addExclusionButton.addEventListener("click", () => {
  const variables = getCompleteVariables();

  if (!variables.length) {
    return;
  }

  recordHistory();
  const first = variables[0];
  const second = variables[1] || variables[0];

  state.exclusions.push({
    id: crypto.randomUUID(),
    conditions: [
      { id: crypto.randomUUID(), variableId: first.id, value: parseValues(first)[0] },
      { id: crypto.randomUUID(), variableId: second.id, value: parseValues(second)[0] }
    ]
  });
  render();
});

elements.loadExampleButton.addEventListener("click", () => {
  recordHistory();
  state = structuredClone(exampleState);
  render();
});

elements.resetButton.addEventListener("click", () => {
  recordHistory();
  state = { variables: [], rules: [], exclusions: [], columnOrder: [], columnPresets: {}, scenarioPattern: "" };
  render();
});

elements.exportButton.addEventListener("click", () => {
  const scenarios = getValidScenarios();
  if (!scenarios.length) {
    return;
  }
  downloadCsv(scenarios);
});
elements.exportJsonButton.addEventListener("click", () => downloadJson(getValidScenarios()));
elements.exportExcelButton.addEventListener("click", () => downloadExcel(getValidScenarios()));

elements.scenarioFilter.addEventListener("input", renderMatrix);
elements.scenarioPattern.addEventListener("input", () => {
  state.scenarioPattern = elements.scenarioPattern.value;
  renderMatrix();
  saveState();
});
elements.toggleColumnOrderButton.addEventListener("click", () => {
  const isExpanded = elements.toggleColumnOrderButton.getAttribute("aria-expanded") === "true";
  setColumnOrderExpanded(!isExpanded);
});
elements.columnOrderText.addEventListener("input", () => {
  updateColumnOrderFromText(elements.columnOrderText.value);
  renderMatrix();
  saveState();
});
elements.saveColumnPresetButton.addEventListener("click", saveColumnPreset);
elements.loadColumnPresetButton.addEventListener("click", loadColumnPreset);

function setColumnOrderExpanded(isExpanded) {
  elements.columnOrderBody.hidden = !isExpanded;
  elements.toggleColumnOrderButton.setAttribute("aria-expanded", String(isExpanded));
  elements.toggleColumnOrderButton.textContent = isExpanded ? "Hide" : "Show";
}

function setValidationExpanded(isExpanded) {
  elements.validationBody.hidden = !isExpanded;
  elements.toggleValidationButton.setAttribute("aria-expanded", String(isExpanded));
  elements.toggleValidationButton.textContent = isExpanded ? "Hide" : "Show";
}

function showTab(tabId) {
  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.tabPanels.forEach((panel) => {
    const isActive = panel.id === tabId;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}

function recordHistory() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = [];
  updateHistoryButtons();
}

function undoChange() {
  if (!undoStack.length) {
    return;
  }
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  render();
}

function redoChange() {
  if (!redoStack.length) {
    return;
  }
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  render();
}

function updateHistoryButtons() {
  elements.undoButton.disabled = undoStack.length === 0;
  elements.redoButton.disabled = redoStack.length === 0;
}

function render() {
  migrateState();
  normalizeRules();
  normalizeExclusions();
  renderVariables();
  renderRules();
  renderExclusions();
  renderSummary();
  renderValidation();
  renderColumnOrder();
  renderColumnPresets();
  renderScenarioOptions();
  renderMatrix();
  updateHistoryButtons();
  saveState();
}

function renderVariables() {
  elements.variablesList.replaceChildren();

  if (!state.variables.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No variables yet.";
    elements.variablesList.append(empty);
    return;
  }

  state.variables.forEach((variable) => {
    const variableFilter = elements.variableSearch.value.trim().toLowerCase();
    const searchableText = `${variable.name} ${parseValues(variable).join(" ")}`.toLowerCase();
    if (variableFilter && !searchableText.includes(variableFilter)) {
      return;
    }

    const node = elements.variableTemplate.content.cloneNode(true);
    const card = node.querySelector(".variable-card");
    const nameInput = node.querySelector(".variable-name");
    const valuesInput = node.querySelector(".variable-values");
    const removeButton = node.querySelector(".remove-variable");

    nameInput.value = variable.name;
    valuesInput.value = variable.valuesText;

    if (!variable.name.trim() || parseValues(variable).length === 0) {
      card.classList.add("invalid-card");
      const warning = document.createElement("p");
      warning.className = "invalid-text";
      warning.textContent = "Name and at least one value are required.";
      card.append(warning);
    }

    nameInput.addEventListener("input", (event) => {
      recordHistory();
      variable.name = event.target.value;
      refreshDerivedViews();
    });
    valuesInput.addEventListener("input", (event) => {
      recordHistory();
      variable.valuesText = event.target.value;
      refreshDerivedViews();
    });
    removeButton.addEventListener("click", () => {
      recordHistory();
      state.variables = state.variables.filter((candidate) => candidate.id !== variable.id);
      state.rules = state.rules.filter((rule) => rule.sourceId !== variable.id && rule.targetId !== variable.id);
      state.exclusions.forEach((exclusion) => {
        exclusion.conditions = exclusion.conditions.filter((condition) => condition.variableId !== variable.id);
      });
      state.exclusions = state.exclusions.filter((exclusion) => exclusion.conditions.length > 0);
      render();
    });

    elements.variablesList.append(node);
  });
}

function importVariables({ merge }) {
  const importedVariables = parseImportedVariables(elements.importText.value);

  if (!importedVariables.length) {
    setImportFeedback("No variables found. Check the pasted rows or CSV file.");
    return;
  }

  recordHistory();
  if (merge) {
    mergeVariables(importedVariables);
  } else {
    state.variables = importedVariables;
    state.rules = [];
    state.exclusions = [];
  }

  render();
  setImportFeedback(`Imported ${importedVariables.length.toLocaleString()} variables.`);
}

function parseImportedVariables(text) {
  const rows = parseDelimitedRows(text);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((cell) => cell.trim());
  const variableColumnIndex = headers.findIndex((header) => isHeaderMatch(header, "variable"));
  const valueColumnIndex = headers.findIndex((header) => isHeaderMatch(header, "value"));

  if (variableColumnIndex >= 0 && valueColumnIndex >= 0) {
    return variablesFromLongRows(rows.slice(1), variableColumnIndex, valueColumnIndex);
  }

  return variablesFromWideRows(headers, rows.slice(1));
}

function variablesFromLongRows(rows, variableColumnIndex, valueColumnIndex) {
  const grouped = new Map();

  rows.forEach((row) => {
    const name = row[variableColumnIndex]?.trim();
    const value = row[valueColumnIndex]?.trim();

    if (!name || !value) {
      return;
    }

    if (!grouped.has(name)) {
      grouped.set(name, []);
    }
    grouped.get(name).push(value);
  });

  return variablesFromGroupedValues(grouped);
}

function variablesFromWideRows(headers, rows) {
  const grouped = new Map();

  headers.forEach((header, columnIndex) => {
    const name = header.trim();
    if (!name) {
      return;
    }

    const values = rows.map((row) => row[columnIndex]?.trim()).filter(Boolean);
    grouped.set(name, values);
  });

  return variablesFromGroupedValues(grouped);
}

function variablesFromGroupedValues(grouped) {
  return Array.from(grouped.entries())
    .map(([name, values]) => ({
      id: crypto.randomUUID(),
      name,
      valuesText: Array.from(new Set(values)).join("\n")
    }))
    .filter((variable) => variable.name && parseValues(variable).length > 0);
}

function mergeVariables(importedVariables) {
  importedVariables.forEach((importedVariable) => {
    const existingVariable = state.variables.find((variable) => variable.name.trim() === importedVariable.name);

    if (!existingVariable) {
      state.variables.push(importedVariable);
      return;
    }

    const mergedValues = Array.from(new Set([...parseValues(existingVariable), ...parseValues(importedVariable)]));
    existingVariable.valuesText = mergedValues.join("\n");
  });
}

function parseDelimitedRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const delimiter = detectDelimiter(text);

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function isHeaderMatch(header, target) {
  return header.trim().toLowerCase() === target;
}

function setImportFeedback(message) {
  elements.importFeedback.textContent = message;
}

function loadBulkVariables() {
  const rows = [];
  getCompleteVariables().forEach((variable) => {
    parseValues(variable).forEach((value) => {
      rows.push(`${csvCell(variable.name.trim())},${csvCell(value)}`);
    });
  });
  elements.bulkVariablesText.value = ["Variable,Value", ...rows].join("\n");
}

function applyBulkVariables() {
  const importedVariables = parseImportedVariables(elements.bulkVariablesText.value);
  if (!importedVariables.length) {
    return;
  }

  recordHistory();
  state.variables = importedVariables;
  state.rules = [];
  state.exclusions = [];
  render();
}

function importExclusions() {
  const rows = parseDelimitedRows(elements.exclusionImportText.value);
  const imported = rows
    .map((row) => {
      const conditions = [];
      for (let index = 0; index < row.length; index += 2) {
        const variable = findVariableByName(row[index] || "");
        const value = row[index + 1]?.trim();
        if (variable && value && parseValues(variable).includes(value)) {
          conditions.push({ id: crypto.randomUUID(), variableId: variable.id, value });
        }
      }
      return conditions.length ? { id: crypto.randomUUID(), conditions } : null;
    })
    .filter(Boolean);

  if (!imported.length) {
    return;
  }

  recordHistory();
  state.exclusions.push(...imported);
  render();
}

function renderRules() {
  elements.rulesList.replaceChildren();

  if (!state.rules.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No dependency rules.";
    elements.rulesList.append(empty);
    return;
  }

  state.rules.forEach((rule) => {
    const ruleFilter = elements.dependencySearch.value.trim().toLowerCase();
    const ruleText = [
      rule.sourceValue,
      getRuleTargetName(rule),
      ...rule.allowedValues,
      ...getRuleConditions(rule).flatMap((condition) => [findVariable(condition.sourceId)?.name, condition.sourceValue])
    ].join(" ").toLowerCase();
    if (ruleFilter && !ruleText.includes(ruleFilter)) {
      return;
    }

    const node = elements.ruleTemplate.content.cloneNode(true);
    const card = node.querySelector(".rule-card");
    const modeSelect = node.querySelector(".rule-mode");
    const conditionsList = node.querySelector(".rule-conditions");
    const sourceSelect = node.querySelector(".rule-source");
    const sourceValueSelect = node.querySelector(".rule-source-value");
    const targetNameInput = node.querySelector(".rule-target-name");
    const targetValuesSelect = node.querySelector(".rule-target-values");
    const customValueInput = node.querySelector(".rule-custom-value");
    const addValueButton = node.querySelector(".add-rule-value");
    const addConditionButton = node.querySelector(".add-rule-condition");
    const rulePreview = node.querySelector(".rule-preview");
    const removeButton = node.querySelector(".remove-rule");

    modeSelect.value = rule.mode || "all";
    getRuleConditions(rule).forEach((condition) => {
      conditionsList.append(createRuleConditionRow(rule, condition));
    });
    fillVariableSelect(sourceSelect, rule.sourceId);
    fillValueSelect(sourceValueSelect, findVariable(rule.sourceId), [rule.sourceValue]);
    targetNameInput.value = getRuleTargetName(rule);
    fillValueSelect(targetValuesSelect, findVariable(rule.targetId), rule.allowedValues);

    if (!isRuleComplete(rule)) {
      card.classList.add("invalid-card");
    }
    rulePreview.textContent = dependencyPreviewText(rule);

    modeSelect.addEventListener("change", (event) => {
      recordHistory();
      rule.mode = event.target.value;
      render();
    });
    sourceSelect.addEventListener("change", (event) => {
      recordHistory();
      rule.sourceId = event.target.value;
      rule.sourceValue = parseValues(findVariable(rule.sourceId))[0] || "";
      render();
    });
    sourceValueSelect.addEventListener("change", (event) => {
      recordHistory();
      rule.sourceValue = event.target.value;
      render();
    });
    targetNameInput.addEventListener("change", (event) => {
      recordHistory();
      updateRuleTargetName(rule, event.target.value);
      render();
    });
    targetValuesSelect.addEventListener("change", () => {
      recordHistory();
      rule.allowedValues = Array.from(targetValuesSelect.selectedOptions, (option) => option.value);
      render();
    });
    addValueButton.addEventListener("click", () => {
      recordHistory();
      addCustomRuleValue(rule, customValueInput.value);
    });
    customValueInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        recordHistory();
        addCustomRuleValue(rule, customValueInput.value);
      }
    });
    addConditionButton.addEventListener("click", () => {
      const variable = firstVariableWithValues();
      if (!variable) {
        return;
      }
      recordHistory();
      rule.conditions.push({
        id: crypto.randomUUID(),
        sourceId: variable.id,
        sourceValue: parseValues(variable)[0] || ""
      });
      render();
    });
    removeButton.addEventListener("click", () => {
      recordHistory();
      state.rules = state.rules.filter((candidate) => candidate.id !== rule.id);
      render();
    });

    elements.rulesList.append(node);
  });
}

function addCustomRuleValue(rule, value) {
  const cleanValue = value.trim();
  const target = ensureRuleTargetVariable(rule);

  if (!target || !cleanValue) {
    return;
  }

  addValueToVariable(target, cleanValue);
  rule.allowedValues = Array.from(new Set([...rule.allowedValues, cleanValue]));
  render();
}

function updateRuleTargetName(rule, name) {
  const cleanName = name.trim();
  const target = findVariableByName(cleanName);

  rule.targetName = cleanName;
  rule.targetId = target?.id || "";
  rule.allowedValues = target
    ? rule.allowedValues.filter((value) => parseValues(target).includes(value))
    : [];
}

function ensureRuleTargetVariable(rule) {
  const cleanName = getRuleTargetName(rule).trim();

  if (!cleanName) {
    return null;
  }

  const existing = findVariable(rule.targetId) || findVariableByName(cleanName);
  if (existing) {
    rule.targetId = existing.id;
    rule.targetName = existing.name.trim();
    return existing;
  }

  const variable = {
    id: crypto.randomUUID(),
    name: cleanName,
    valuesText: ""
  };

  state.variables.push(variable);
  rule.targetId = variable.id;
  rule.targetName = variable.name;
  return variable;
}

function getRuleTargetName(rule) {
  return findVariable(rule.targetId)?.name.trim() || rule.targetName || "";
}

function getRuleConditions(rule) {
  rule.conditions ||= [];
  return rule.conditions;
}

function createRuleConditionRow(rule, condition) {
  const row = document.createElement("div");
  const variableLabel = document.createElement("label");
  const valueLabel = document.createElement("label");
  const variableText = document.createElement("span");
  const valueText = document.createElement("span");
  const variableSelect = document.createElement("select");
  const valueSelect = document.createElement("select");
  const removeButton = document.createElement("button");

  row.className = "condition-row";
  variableText.textContent = "Also when";
  valueText.textContent = "Equals";
  removeButton.className = "icon-button";
  removeButton.type = "button";
  removeButton.title = "Remove condition";
  removeButton.setAttribute("aria-label", "Remove condition");
  removeButton.textContent = "×";

  fillVariableSelect(variableSelect, condition.sourceId);
  fillValueSelect(valueSelect, findVariable(condition.sourceId), [condition.sourceValue]);

  variableSelect.addEventListener("change", (event) => {
    recordHistory();
    condition.sourceId = event.target.value;
    condition.sourceValue = parseValues(findVariable(condition.sourceId))[0] || "";
    render();
  });
  valueSelect.addEventListener("change", (event) => {
    recordHistory();
    condition.sourceValue = event.target.value;
    render();
  });
  removeButton.addEventListener("click", () => {
    recordHistory();
    rule.conditions = rule.conditions.filter((candidate) => candidate.id !== condition.id);
    render();
  });

  variableLabel.append(variableText, variableSelect);
  valueLabel.append(valueText, valueSelect);
  row.append(variableLabel, valueLabel, removeButton);
  return row;
}

function dependencyPreviewText(rule) {
  const scenarios = buildCombinations(getCompleteVariables());
  const triggered = scenarios.filter((scenario) => ruleTriggers(rule, scenario));
  const validAfterRule = triggered.filter((scenario) => satisfiesSingleRule(rule, scenario));
  const removed = triggered.length - validAfterRule.length;
  return `${triggered.length.toLocaleString()} scenarios match condition; ${removed.toLocaleString()} removed by this dependency.`;
}

function renderExclusions() {
  elements.exclusionsList.replaceChildren();

  if (!state.exclusions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No exclusions.";
    elements.exclusionsList.append(empty);
    return;
  }

  state.exclusions.forEach((exclusion) => {
    const exclusionFilter = elements.exclusionSearch.value.trim().toLowerCase();
    const exclusionText = exclusion.conditions
      .flatMap((condition) => [findVariable(condition.variableId)?.name, condition.value])
      .join(" ")
      .toLowerCase();
    if (exclusionFilter && !exclusionText.includes(exclusionFilter)) {
      return;
    }

    const node = elements.exclusionTemplate.content.cloneNode(true);
    const card = node.querySelector(".exclusion-card");
    const conditionList = node.querySelector(".condition-list");
    const addConditionButton = node.querySelector(".add-condition");
    const removeExclusionButton = node.querySelector(".remove-exclusion");

    if (!isExclusionComplete(exclusion)) {
      card.classList.add("invalid-card");
    }

    exclusion.conditions.forEach((condition) => {
      conditionList.append(createConditionRow(exclusion, condition));
    });

    addConditionButton.addEventListener("click", () => {
      const variable = getCompleteVariables()[0];
      if (!variable) {
        return;
      }

      recordHistory();
      exclusion.conditions.push({
        id: crypto.randomUUID(),
        variableId: variable.id,
        value: parseValues(variable)[0]
      });
      render();
    });

    removeExclusionButton.addEventListener("click", () => {
      recordHistory();
      state.exclusions = state.exclusions.filter((candidate) => candidate.id !== exclusion.id);
      render();
    });

    elements.exclusionsList.append(node);
  });
}

function createConditionRow(exclusion, condition) {
  const row = document.createElement("div");
  const variableLabel = document.createElement("label");
  const valueLabel = document.createElement("label");
  const variableText = document.createElement("span");
  const valueText = document.createElement("span");
  const variableSelect = document.createElement("select");
  const valueSelect = document.createElement("select");
  const removeButton = document.createElement("button");

  row.className = "condition-row";
  variableText.textContent = "Where";
  valueText.textContent = "Equals";
  removeButton.className = "icon-button";
  removeButton.type = "button";
  removeButton.title = "Remove condition";
  removeButton.setAttribute("aria-label", "Remove condition");
  removeButton.textContent = "×";

  fillVariableSelect(variableSelect, condition.variableId);
  fillValueSelect(valueSelect, findVariable(condition.variableId), [condition.value]);

  variableSelect.addEventListener("change", (event) => {
    recordHistory();
    condition.variableId = event.target.value;
    condition.value = parseValues(findVariable(condition.variableId))[0] || "";
    render();
  });
  valueSelect.addEventListener("change", (event) => {
    recordHistory();
    condition.value = event.target.value;
    render();
  });
  removeButton.addEventListener("click", () => {
    recordHistory();
    exclusion.conditions = exclusion.conditions.filter((candidate) => candidate.id !== condition.id);
    render();
  });

  variableLabel.append(variableText, variableSelect);
  valueLabel.append(valueText, valueSelect);
  row.append(variableLabel, valueLabel, removeButton);
  return row;
}

function renderSummary() {
  const completeVariables = getCompleteVariables();
  const rawCount = completeVariables.reduce((product, variable) => product * parseValues(variable).length, completeVariables.length ? 1 : 0);
  const issues = getValidationIssues();

  elements.variableCount.textContent = completeVariables.length.toLocaleString();
  elements.rawCombinationCount.textContent = rawCount.toLocaleString();
  elements.validScenarioCount.textContent = getValidScenarios().length.toLocaleString();
  elements.ruleCount.textContent = state.rules.filter(isRuleComplete).length.toLocaleString();
  elements.exclusionCount.textContent = state.exclusions.filter(isExclusionComplete).length.toLocaleString();
  elements.validationCount.textContent = issues.length.toLocaleString();
}

function renderValidation() {
  const issues = getValidationIssues();
  elements.validationList.replaceChildren();

  if (!issues.length) {
    const item = document.createElement("li");
    item.textContent = "No validation issues.";
    elements.validationList.append(item);
    return;
  }

  issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = issue;
    elements.validationList.append(item);
  });
}

function renderColumnOrder() {
  const variables = getOrderedVariables();

  if (document.activeElement === elements.columnOrderText) {
    return;
  }

  elements.columnOrderText.value = variables.map((variable) => variable.name.trim()).join("\n");
}

function renderScenarioOptions() {
  if (document.activeElement !== elements.scenarioPattern) {
    elements.scenarioPattern.value = state.scenarioPattern || "";
  }
}

function updateColumnOrderFromText(text) {
  const variablesByName = new Map(getCompleteVariables().map((variable) => [variable.name.trim().toLowerCase(), variable]));
  const orderedIds = [];

  text
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const variable = variablesByName.get(name.toLowerCase());
      if (variable && !orderedIds.includes(variable.id)) {
        orderedIds.push(variable.id);
      }
    });

  state.columnOrder = orderedIds;
}

function renderColumnPresets() {
  const currentValue = elements.columnPresetSelect.value;
  elements.columnPresetSelect.replaceChildren();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select preset";
  elements.columnPresetSelect.append(emptyOption);

  Object.keys(state.columnPresets || {}).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === currentValue;
    elements.columnPresetSelect.append(option);
  });
}

function saveColumnPreset() {
  const name = elements.columnPresetName.value.trim();
  if (!name) {
    return;
  }
  state.columnPresets ||= {};
  state.columnPresets[name] = elements.columnOrderText.value;
  elements.columnPresetName.value = "";
  renderColumnPresets();
  saveState();
}

function loadColumnPreset() {
  const name = elements.columnPresetSelect.value;
  const preset = state.columnPresets?.[name];
  if (!preset) {
    return;
  }
  elements.columnOrderText.value = preset;
  updateColumnOrderFromText(preset);
  renderMatrix();
  saveState();
}

function renderMatrix() {
  const scenarios = getValidScenarios();
  const filterText = elements.scenarioFilter.value.trim().toLowerCase();
  const filteredScenarios = filterText
    ? scenarios.filter((scenario) => Object.entries(scenario).some(([key, value]) => `${key} ${value}`.toLowerCase().includes(filterText)))
    : scenarios;
  const variables = getOrderedVariables();
  const duplicateGroups = getDuplicateScenarioGroups(filteredScenarios, variables);
  const thead = elements.matrixTable.querySelector("thead");
  const tbody = elements.matrixTable.querySelector("tbody");

  thead.replaceChildren();
  tbody.replaceChildren();

  if (!variables.length || !filteredScenarios.length) {
    elements.statusText.textContent = variables.length ? "No valid scenarios match the current inputs." : "Add variables to begin.";
    elements.exportButton.disabled = scenarios.length === 0;
    elements.exportJsonButton.disabled = scenarios.length === 0;
    elements.exportExcelButton.disabled = scenarios.length === 0;
    renderDuplicateList([]);
    renderEmptyMatrixMessage(tbody, variables.length ? variables.length + 1 : 1);
    return;
  }

  elements.exportButton.disabled = false;
  elements.exportJsonButton.disabled = false;
  elements.exportExcelButton.disabled = false;
  elements.statusText.textContent = statusMessage(filteredScenarios.length, scenarios.length, duplicateGroups.length);
  renderDuplicateList(duplicateGroups);

  const headerRow = document.createElement("tr");
  const scenarioHeader = document.createElement("th");
  scenarioHeader.textContent = "Scenario ID";
  headerRow.append(scenarioHeader);

  variables.forEach((variable) => {
    const th = document.createElement("th");
    th.textContent = variable.name.trim();
    headerRow.append(th);
  });
  thead.append(headerRow);

  filteredScenarios.slice(0, MAX_RENDERED_ROWS).forEach((scenario, index) => {
    const tr = document.createElement("tr");
    const numberCell = document.createElement("td");
    numberCell.textContent = scenarioId(scenario, index + 1);
    if (duplicateGroups.some((group) => group.key === scenarioKey(scenario, variables))) {
      tr.classList.add("duplicate-row");
    }
    tr.append(numberCell);

    variables.forEach((variable) => {
      const td = document.createElement("td");
      td.textContent = scenario[variable.name.trim()];
      tr.append(td);
    });

    tbody.append(tr);
  });
}

function refreshDerivedViews() {
  normalizeRules();
  normalizeExclusions();
  renderRules();
  renderExclusions();
  renderSummary();
  renderColumnOrder();
  renderMatrix();
  saveState();
}

function renderEmptyMatrixMessage(tbody, columnCount) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = columnCount;
  cell.className = "empty-state";
  cell.textContent = "No rows to display.";
  row.append(cell);
  tbody.append(row);
}

function statusMessage(filteredCount, totalCount, duplicateCount = 0) {
  const capped = filteredCount > MAX_RENDERED_ROWS ? ` Showing first ${MAX_RENDERED_ROWS.toLocaleString()}.` : "";
  const filterNote = filteredCount === totalCount ? "" : ` ${filteredCount.toLocaleString()} match the filter.`;
  const warning = totalCount > SCENARIO_WARNING_THRESHOLD ? ` Large matrix warning: ${totalCount.toLocaleString()} rows.` : "";
  const duplicateNote = duplicateCount ? ` ${duplicateCount.toLocaleString()} duplicate pattern${duplicateCount === 1 ? "" : "s"} detected.` : "";
  return `${totalCount.toLocaleString()} valid scenarios.${filterNote}${duplicateNote}${warning}${capped}`;
}

function renderDuplicateList(groups) {
  elements.duplicateList.replaceChildren();
  if (!groups.length) {
    const item = document.createElement("div");
    item.textContent = "No duplicate scenarios detected.";
    elements.duplicateList.append(item);
    return;
  }

  groups.slice(0, 10).forEach((group) => {
    const item = document.createElement("div");
    item.textContent = `${group.count} rows share: ${group.label}`;
    elements.duplicateList.append(item);
  });
}

function scenarioId(scenario, index) {
  const pattern = state.scenarioPattern?.trim();
  if (!pattern) {
    return String(index);
  }

  return pattern.replace(/\{([^}]+)\}/g, (_, key) => {
    const cleanKey = key.trim();
    if (cleanKey.toLowerCase() === "scenario") {
      return String(index);
    }
    return scenario[cleanKey] ?? "";
  });
}

function fillVariableSelect(select, selectedId) {
  select.replaceChildren();
  getCompleteVariables().forEach((variable) => {
    const option = document.createElement("option");
    option.value = variable.id;
    option.textContent = variable.name.trim();
    option.selected = variable.id === selectedId;
    select.append(option);
  });
}

function fillValueSelect(select, variable, selectedValues) {
  select.replaceChildren();
  parseValues(variable).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = selectedValues.includes(value);
    select.append(option);
  });
}

function getValidScenarios() {
  const variables = getCompleteVariables();
  const combinations = buildCombinations(variables);
  return combinations.filter(satisfiesRules).filter((scenario) => !isExcludedScenario(scenario));
}

function getOrderedVariables() {
  normalizeColumnOrder();
  const variablesById = new Map(getCompleteVariables().map((variable) => [variable.id, variable]));
  return state.columnOrder.map((id) => variablesById.get(id)).filter(Boolean);
}

function getDuplicateScenarioGroups(scenarios, variables) {
  const groups = new Map();
  scenarios.forEach((scenario) => {
    const key = scenarioKey(scenario, variables);
    const label = variables.map((variable) => `${variable.name.trim()}=${scenario[variable.name.trim()]}`).join(", ");
    const group = groups.get(key) || { key, label, count: 0 };
    group.count += 1;
    groups.set(key, group);
  });
  return Array.from(groups.values()).filter((group) => group.count > 1);
}

function scenarioKey(scenario, variables) {
  return variables.map((variable) => `${variable.name.trim()}=${scenario[variable.name.trim()]}`).join("\u001f");
}

function buildCombinations(variables) {
  if (!variables.length) {
    return [];
  }

  return variables.reduce((rows, variable) => {
    const name = variable.name.trim();
    const values = parseValues(variable);

    if (!rows.length) {
      return values.map((value) => ({ [name]: value }));
    }

    return rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value })));
  }, []);
}

function satisfiesRules(scenario) {
  return state.rules.filter(isRuleComplete).every((rule) => satisfiesSingleRule(rule, scenario));
}

function satisfiesSingleRule(rule, scenario) {
  if (!ruleTriggers(rule, scenario)) {
    return true;
  }

  const target = findVariable(rule.targetId);
  return target && rule.allowedValues.includes(scenario[target.name.trim()]);
}

function ruleTriggers(rule, scenario) {
  const conditions = [
    { sourceId: rule.sourceId, sourceValue: rule.sourceValue },
    ...getRuleConditions(rule)
  ];
  const mode = rule.mode || "all";
  const matches = conditions.map((condition) => {
    const variable = findVariable(condition.sourceId);
    return variable && scenario[variable.name.trim()] === condition.sourceValue;
  });

  return mode === "any" ? matches.some(Boolean) : matches.every(Boolean);
}

function normalizeRules() {
  state.rules.forEach((rule) => {
    const sourceValues = parseValues(findVariable(rule.sourceId));
    const target = findVariable(rule.targetId) || findVariableByName(rule.targetName || "");
    const targetValues = parseValues(target);

    if (!sourceValues.includes(rule.sourceValue)) {
      rule.sourceValue = sourceValues[0] || "";
    }
    getRuleConditions(rule).forEach((condition) => {
      const values = parseValues(findVariable(condition.sourceId));
      if (!values.includes(condition.sourceValue)) {
        condition.sourceValue = values[0] || "";
      }
    });

    if (target) {
      rule.targetId = target.id;
      rule.targetName = target.name.trim();
    }

    rule.allowedValues = rule.allowedValues.filter((value) => targetValues.includes(value));
    if (!rule.allowedValues.length && targetValues.length) {
      rule.allowedValues = [targetValues[0]];
    }
  });
}

function normalizeExclusions() {
  state.exclusions.forEach((exclusion) => {
    exclusion.conditions.forEach((condition) => {
      const values = parseValues(findVariable(condition.variableId));

      if (!values.includes(condition.value)) {
        condition.value = values[0] || "";
      }
    });
  });
}

function isRuleComplete(rule) {
  const source = findVariable(rule.sourceId);
  const target = findVariable(rule.targetId) || findVariableByName(rule.targetName || "");
  return Boolean(
    source &&
      target &&
      source.id !== target.id &&
      parseValues(source).includes(rule.sourceValue) &&
      getRuleConditions(rule).every((condition) => {
        const variable = findVariable(condition.sourceId);
        return variable && parseValues(variable).includes(condition.sourceValue);
      }) &&
      rule.allowedValues.length &&
      rule.allowedValues.every((value) => parseValues(target).includes(value))
  );
}

function isExclusionComplete(exclusion) {
  return Boolean(
    exclusion.conditions.length &&
      exclusion.conditions.every((condition) => {
        const variable = findVariable(condition.variableId);
        return variable && parseValues(variable).includes(condition.value);
      })
  );
}

function isExcludedScenario(scenario) {
  return state.exclusions.filter(isExclusionComplete).some((exclusion) =>
    exclusion.conditions.every((condition) => {
      const variable = findVariable(condition.variableId);
      return scenario[variable.name.trim()] === condition.value;
    })
  );
}

function getCompleteVariables() {
  const seenNames = new Set();
  return state.variables.filter((variable) => {
    const name = variable.name.trim();
    if (!name || seenNames.has(name) || parseValues(variable).length === 0) {
      return false;
    }
    seenNames.add(name);
    return true;
  });
}

function getValidationIssues() {
  const issues = [];
  const names = new Map();
  state.variables.forEach((variable) => {
    const name = variable.name.trim();
    if (!name) {
      issues.push("A variable is missing a name.");
    } else if (names.has(name.toLowerCase())) {
      issues.push(`Duplicate variable name: ${name}.`);
    }
    names.set(name.toLowerCase(), true);
    if (!parseValues(variable).length) {
      issues.push(`${name || "A variable"} has no values.`);
    }
  });

  state.rules.forEach((rule, index) => {
    if (!isRuleComplete(rule)) {
      issues.push(`Dependency ${index + 1} is incomplete.`);
    }
  });

  state.exclusions.forEach((exclusion, index) => {
    if (!isExclusionComplete(exclusion)) {
      issues.push(`Exclusion ${index + 1} is incomplete.`);
    }
  });

  const rawCount = getCompleteVariables().reduce((product, variable) => product * parseValues(variable).length, getCompleteVariables().length ? 1 : 0);
  if (rawCount > SCENARIO_WARNING_THRESHOLD) {
    issues.push(`Raw matrix has ${rawCount.toLocaleString()} combinations and may render slowly.`);
  }
  if (rawCount && getValidScenarios().length === 0) {
    issues.push("Current rules/exclusions remove every scenario.");
  }

  elements.columnOrderText.value
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      if (!findVariableByName(name)) {
        issues.push(`Column order references unknown variable: ${name}.`);
      }
    });

  return issues;
}

function normalizeColumnOrder() {
  state.columnOrder ||= [];
  const completeVariables = getCompleteVariables();
  const completeIds = new Set(completeVariables.map((variable) => variable.id));
  const orderedIds = state.columnOrder.filter((id) => completeIds.has(id));

  completeVariables.forEach((variable) => {
    if (!orderedIds.includes(variable.id)) {
      orderedIds.push(variable.id);
    }
  });

  state.columnOrder = orderedIds;
}

function firstVariableWithValues() {
  return state.variables.find((variable) => parseValues(variable).length > 0);
}

function parseValues(variable) {
  if (!variable?.valuesText) {
    return [];
  }

  return Array.from(
    new Set(
      variable.valuesText
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function addValueToVariable(variable, value) {
  const values = parseValues(variable);

  if (values.includes(value)) {
    return;
  }

  variable.valuesText = [...values, value].join("\n");
}

function findVariable(id) {
  return state.variables.find((variable) => variable.id === id);
}

function findVariableByName(name) {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName) {
    return null;
  }

  return state.variables.find((variable) => variable.name.trim().toLowerCase() === cleanName);
}

function migrateState() {
  state.variables ||= [];
  state.rules ||= [];
  state.exclusions ||= [];
  state.columnOrder ||= [];
  state.columnPresets ||= {};
  state.scenarioPattern ||= "";
  state.rules.forEach((rule) => {
    rule.mode ||= "all";
    rule.conditions ||= [];
    rule.targetName ||= findVariable(rule.targetId)?.name.trim() || "";
    rule.allowedValues ||= [];
  });
  state.exclusions.forEach((exclusion) => {
    exclusion.conditions ||= [];
  });
}

function saveProjectFile() {
  downloadBlob(JSON.stringify(state, null, 2), "trade_matrix_project.json", "application/json");
}

async function loadProjectFile(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    const nextState = JSON.parse(await file.text());
    recordHistory();
    state = nextState;
    render();
  } finally {
    elements.loadProjectFile.value = "";
  }
}

function downloadCsv(scenarios) {
  const variables = getOrderedVariables();
  const headers = ["Scenario", ...variables.map((variable) => variable.name.trim())];
  const rows = scenarios.map((scenario, index) => [
    scenarioId(scenario, index + 1),
    ...variables.map((variable) => scenario[variable.name.trim()])
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadBlob(csv, "trade_matrix.csv", "text/csv;charset=utf-8");
}

function downloadJson(scenarios) {
  const payload = scenarios.map((scenario, index) => ({
    Scenario: scenarioId(scenario, index + 1),
    ...scenario
  }));
  downloadBlob(JSON.stringify(payload, null, 2), "trade_matrix_scenarios.json", "application/json");
}

function downloadExcel(scenarios) {
  const variables = getOrderedVariables();
  const headers = ["Scenario", ...variables.map((variable) => variable.name.trim())];
  const rows = scenarios.map((scenario, index) => [
    scenarioId(scenario, index + 1),
    ...variables.map((variable) => scenario[variable.name.trim()])
  ]);
  const tableRows = [headers, ...rows]
    .map((row) => `<tr>${row.map((value) => `<td>${htmlEscape(value)}</td>`).join("")}</tr>`)
    .join("");
  downloadBlob(`<table>${tableRows}</table>`, "trade_matrix.xls", "application/vnd.ms-excel");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

render();
