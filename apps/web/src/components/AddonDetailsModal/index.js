// Copyright (C) 2017-2024 Smart code 203358507

// Interop shim: AddonDetailsModal is now a .tsx default export; the ESM barrel
// (components/index.ts) default-imports this directory. Unwrap `.default`.
module.exports = require('./AddonDetailsModal').default;
