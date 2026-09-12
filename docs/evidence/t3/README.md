# T3 curated visual evidence

Actual production-build Chrome captures from the full browser run at
`48863e8457adf924f95418b9e3c9f3eae3edea5d` (production code last changed at
`e17034b88d21fcf469f2cb09847f897bb32f7e1b`). Manually reviewed for clipping,
overflow, density, source truth, status clarity, chart usability and control visibility.
No screenshots were generated or painted. PNG optimization is lossless; decoded pixels
were compared byte-for-byte. Routine tests write only to ignored `test-results/t3/`.

[Manifest](manifest.json) records dimensions, hashes, byte sizes and exact findings for
all 21 T3 axe scans: zero violations at every severity. Native focus/Escape/reduced-motion
and x/y control bounds are separately asserted by the Chrome suite. The unchanged later-stage
navigation labels are safe-state routes; their presence is not implementation of those stages.

| Screenshot                                             | Viewport | Evidence                                                              |
| ------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| [desktop-catalog.png](desktop-catalog.png)             | 1440×900 | Stored series, source, coverage and gap health                        |
| [desktop-configuration.png](desktop-configuration.png) | 1440×900 | Explicit Method/data/range/driver configuration                       |
| [desktop-completed.png](desktop-completed.png)         | 1440×900 | Completed counts and per-timestamp calculation values                 |
| [desktop-timestamp.png](desktop-timestamp.png)         | 1440×900 | True rule inspection with analysis values                             |
| [desktop-unavailable.png](desktop-unavailable.png)     | 1440×900 | Unavailable analysis and rule diagnostics, separate judgment question |
| [laptop-completed.png](laptop-completed.png)           | 1024×768 | Laptop result inspection and visible shell controls                   |
| [mobile-configuration.png](mobile-configuration.png)   | 390×844  | Mobile configuration and visible Ctrl K                               |
| [mobile-completed.png](mobile-completed.png)           | 390×844  | Mobile result inspection and visible Ctrl K                           |

Eight images total 435,693 bytes. All operational times and IDs are fixture-test records.
