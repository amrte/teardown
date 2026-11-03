import {runLive} from '../transformer-shared/live.js';

// One real unit: R&S DSO-1600/10.0/0.40-S-NS-NU-CU-CU, every value from its offer datasheet (presets.js). The page and
// its auto tour start from that datasheet; CONFIG → DATASHEET → GENERIC leaves it for the configurable model.
runLive({preset: 'dso1600'});
