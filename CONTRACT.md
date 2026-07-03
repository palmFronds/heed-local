This file establishes the data-heed selectors which is lowkey important. These selectors are defined in feat/demo-platform and consumed by feat/heed-sdk and feat/agents. Do not rename them. Changing one requires updating all three branches.

The selectors look as follows
```
[data-heed="amount-input"]      Screen 2 — amount entry field
[data-heed="fee-row"]           Screen 2 — fee disclosure row
[data-heed="min-received-row"]  Screen 2 — minimum received row
[data-heed="proceed-cta"]       Screen 2 — proceed button
[data-heed="confirm-cta"]       Screen 3 — confirm button
[data-heed="back-btn"]          Screen 3 — back button
[data-heed="flow-complete"]     Screen 4 — success element
```
