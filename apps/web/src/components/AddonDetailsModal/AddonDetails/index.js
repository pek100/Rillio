// Copyright (C) 2017-2024 Smart code 203358507

// Interop shim: AddonDetails is now a .tsx default export; the CJS-facing require
// in AddonDetailsModal resolves this directory. Unwrap `.default`.
module.exports = require('./AddonDetails').default;
