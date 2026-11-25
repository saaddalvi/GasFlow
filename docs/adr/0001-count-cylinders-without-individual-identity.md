# Count cylinders without tracking them individually

Cylinders are counted by gas and quantity only: no cylinder numbers and no sizes. This matches how returns are received (staff type how many came back against a bill) and needs no extra data entry. Tracking individual cylinders was rejected even though the product GasFlow is modelled on advertises per-cylinder history.

## Consequences

The app cannot say which physical cylinder came back, so allocating a return to a dispatch bill is the staff member's choice. Adding cylinder identity later would leave past bills with no cylinder history and would require reworking returns and allocations.
