const STORAGE_KEY = "trade-matrix-builder-state-v1";
const MAX_RENDERED_ROWS = 500;

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
  tabButtons: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  addVariableButton: document.querySelector("#addVariableButton"),
  addRuleButton: document.querySelector("#addRuleButton"),
  addExclusionButton: document.querySelector("#addExclusionButton"),
  loadExampleButton: document.querySelector("#loadExampleButton"),
  resetButton: document.querySelector("#resetButton"),
  exportButton: document.querySelector("#exportButton"),
  scenarioFilter: document.querySelector("#scenarioFilter"),
  columnOrderText: document.querySelector("#columnOrderText"),
  columnOrderBody: document.querySelector("#columnOrderBody"),
  toggleColumnOrderButton: document.querySelector("#toggleColumnOrderButton"),
  matrixTable: document.querySelector("#matrixTable"),
  statusText: document.querySelector("#statusText"),
  variableCount: document.querySelector("#variableCount"),
  rawCombinationCount: document.querySelector("#rawCombinationCount"),
  validScenarioCount: document.querySelector("#validScenarioCount"),
  ruleCount: document.querySelector("#ruleCount"),
  exclusionCount: document.querySelector("#exclusionCount")
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

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

elements.addVariableButton.addEventListener("click", () => {
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
  state = structuredClone(exampleState);
  render();
});

elements.resetButton.addEventListener("click", () => {
  state = { variables: [], rules: [], exclusions: [] };
  render();
});

elements.exportButton.addEventListener("click", () => {
  const scenarios = getValidScenarios();
  if (!scenarios.length) {
    return;
  }
  downloadCsv(scenarios);
});

elements.scenarioFilter.addEventListener("input", renderMatrix);
elements.toggleColumnOrderButton.addEventListener("click", () => {
  const isExpanded = elements.toggleColumnOrderButton.getAttribute("aria-expanded") === "true";
  setColumnOrderExpanded(!isExpanded);
});
elements.columnOrderText.addEventListener("input", () => {
  updateColumnOrderFromText(elements.columnOrderText.value);
  renderMatrix();
  saveState();
});

function setColumnOrderExpanded(isExpanded) {
  elements.columnOrderBody.hidden = !isExpanded;
  elements.toggleColumnOrderButton.setAttribute("aria-expanded", String(isExpanded));
  elements.toggleColumnOrderButton.textContent = isExpanded ? "Hide" : "Show";
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

function render() {
  migrateState();
  normalizeRules();
  normalizeExclusions();
  renderVariables();
  renderRules();
  renderExclusions();
  renderSummary();
  renderColumnOrder();
  renderMatrix();
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
      variable.name = event.target.value;
      refreshDerivedViews();
    });
    valuesInput.addEventListener("input", (event) => {
      variable.valuesText = event.target.value;
      refreshDerivedViews();
    });
    removeButton.addEventListener("click", () => {
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
    const node = elements.ruleTemplate.content.cloneNode(true);
    const card = node.querySelector(".rule-card");
    const sourceSelect = node.querySelector(".rule-source");
    const sourceValueSelect = node.querySelector(".rule-source-value");
    const targetNameInput = node.querySelector(".rule-target-name");
    const targetValuesSelect = node.querySelector(".rule-target-values");
    const customValueInput = node.querySelector(".rule-custom-value");
    const addValueButton = node.querySelector(".add-rule-value");
    const removeButton = node.querySelector(".remove-rule");

    fillVariableSelect(sourceSelect, rule.sourceId);
    fillValueSelect(sourceValueSelect, findVariable(rule.sourceId), [rule.sourceValue]);
    targetNameInput.value = getRuleTargetName(rule);
    fillValueSelect(targetValuesSelect, findVariable(rule.targetId), rule.allowedValues);

    if (!isRuleComplete(rule)) {
      card.classList.add("invalid-card");
    }

    sourceSelect.addEventListener("change", (event) => {
      rule.sourceId = event.target.value;
      rule.sourceValue = parseValues(findVariable(rule.sourceId))[0] || "";
      render();
    });
    sourceValueSelect.addEventListener("change", (event) => {
      rule.sourceValue = event.target.value;
      render();
    });
    targetNameInput.addEventListener("change", (event) => {
      updateRuleTargetName(rule, event.target.value);
      render();
    });
    targetValuesSelect.addEventListener("change", () => {
      rule.allowedValues = Array.from(targetValuesSelect.selectedOptions, (option) => option.value);
      render();
    });
    addValueButton.addEventListener("click", () => {
      addCustomRuleValue(rule, customValueInput.value);
    });
    customValueInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomRuleValue(rule, customValueInput.value);
      }
    });
    removeButton.addEventListener("click", () => {
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

      exclusion.conditions.push({
        id: crypto.randomUUID(),
        variableId: variable.id,
        value: parseValues(variable)[0]
      });
      render();
    });

    removeExclusionButton.addEventListener("click", () => {
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
    condition.variableId = event.target.value;
    condition.value = parseValues(findVariable(condition.variableId))[0] || "";
    render();
  });
  valueSelect.addEventListener("change", (event) => {
    condition.value = event.target.value;
    render();
  });
  removeButton.addEventListener("click", () => {
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

  elements.variableCount.textContent = completeVariables.length.toLocaleString();
  elements.rawCombinationCount.textContent = rawCount.toLocaleString();
  elements.validScenarioCount.textContent = getValidScenarios().length.toLocaleString();
  elements.ruleCount.textContent = state.rules.filter(isRuleComplete).length.toLocaleString();
  elements.exclusionCount.textContent = state.exclusions.filter(isExclusionComplete).length.toLocaleString();
}

function renderColumnOrder() {
  const variables = getOrderedVariables();

  if (document.activeElement === elements.columnOrderText) {
    return;
  }

  elements.columnOrderText.value = variables.map((variable) => variable.name.trim()).join("\n");
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

function renderMatrix() {
  const scenarios = getValidScenarios();
  const filterText = elements.scenarioFilter.value.trim().toLowerCase();
  const filteredScenarios = filterText
    ? scenarios.filter((scenario) => Object.entries(scenario).some(([key, value]) => `${key} ${value}`.toLowerCase().includes(filterText)))
    : scenarios;
  const variables = getOrderedVariables();
  const thead = elements.matrixTable.querySelector("thead");
  const tbody = elements.matrixTable.querySelector("tbody");

  thead.replaceChildren();
  tbody.replaceChildren();

  if (!variables.length || !filteredScenarios.length) {
    elements.statusText.textContent = variables.length ? "No valid scenarios match the current inputs." : "Add variables to begin.";
    elements.exportButton.disabled = scenarios.length === 0;
    renderEmptyMatrixMessage(tbody, variables.length ? variables.length + 1 : 1);
    return;
  }

  elements.exportButton.disabled = false;
  elements.statusText.textContent = statusMessage(filteredScenarios.length, scenarios.length);

  const headerRow = document.createElement("tr");
  const scenarioHeader = document.createElement("th");
  scenarioHeader.textContent = "Scenario";
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
    numberCell.textContent = String(index + 1);
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

function statusMessage(filteredCount, totalCount) {
  const capped = filteredCount > MAX_RENDERED_ROWS ? ` Showing first ${MAX_RENDERED_ROWS.toLocaleString()}.` : "";
  const filterNote = filteredCount === totalCount ? "" : ` ${filteredCount.toLocaleString()} match the filter.`;
  return `${totalCount.toLocaleString()} valid scenarios.${filterNote}${capped}`;
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
  return state.rules.filter(isRuleComplete).every((rule) => {
    const source = findVariable(rule.sourceId);
    const target = findVariable(rule.targetId);
    const sourceName = source.name.trim();
    const targetName = target.name.trim();

    if (scenario[sourceName] !== rule.sourceValue) {
      return true;
    }

    return rule.allowedValues.includes(scenario[targetName]);
  });
}

function normalizeRules() {
  state.rules.forEach((rule) => {
    const sourceValues = parseValues(findVariable(rule.sourceId));
    const target = findVariable(rule.targetId) || findVariableByName(rule.targetName || "");
    const targetValues = parseValues(target);

    if (!sourceValues.includes(rule.sourceValue)) {
      rule.sourceValue = sourceValues[0] || "";
    }

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
  state.rules.forEach((rule) => {
    rule.targetName ||= findVariable(rule.targetId)?.name.trim() || "";
    rule.allowedValues ||= [];
  });
  state.exclusions.forEach((exclusion) => {
    exclusion.conditions ||= [];
  });
}

function downloadCsv(scenarios) {
  const variables = getOrderedVariables();
  const headers = ["Scenario", ...variables.map((variable) => variable.name.trim())];
  const rows = scenarios.map((scenario, index) => [
    index + 1,
    ...variables.map((variable) => scenario[variable.name.trim()])
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "trade_matrix.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
