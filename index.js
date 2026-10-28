/**
 * v6
 *
 * @url https://github.com/RonaldR/homebridge-camera-ui
 * @author SeydX <seydx@outlook.de>
 *
 **/
'use-strict';

import { HomebridgeCameraUI } from './src/platform.js';

export default (api) => {
  api.registerPlatform('homebridge-camera-ui-v2', 'CameraUI', HomebridgeCameraUI, true);
};
