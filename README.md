# Trade Matrix Builder

A static browser tool for building full-factorial trade matrices with dependency and exclusion rules.

Open `index.html` in a browser. No install step is required.

## Current Capabilities

- Add scenario variables with one value per line or comma-separated values.
- Import variables from pasted CSV/TSV text or a local `.csv`, `.tsv`, or `.txt` file.
- Add dependency rules in the form: when variable A equals value X, apply one or more typed constraint values.
- Add a new constraint name and value directly from a dependency rule.
- Add exclusion rules that remove rows where all selected variable/value conditions match.
- Generate all valid scenario combinations.
- Filter the generated table.
- Export the matrix as `trade_matrix.csv`.
- Persist the current workspace in browser local storage.

## Notes

The first version treats dependency rules as constraints over a full factorial matrix. For example, if `Sensor Package = Passive` constrains `Comms Mode` to `Silent`, all generated rows where `Sensor Package` is `Passive` and `Comms Mode` is not `Silent` are removed.

Exclusion rules run after dependency rules. For example, an exclusion with `Sensor Package = Baseline` and `Weather = Rain` deletes every row matching both values.

Imports support two shapes:

- Wide rows: headers are variable names, and each column contains the values for that variable.
- Long rows: one column named `Variable` and one column named `Value`.
