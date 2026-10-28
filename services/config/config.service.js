/* eslint-disable unicorn/prefer-number-properties */
'use-strict';

import ffmpegPath from 'ffmpeg-for-homebridge';
import fs from 'fs-extra';
import path from 'path';
import { ConfigSetup } from 'camera.ui/src/services/config/config.defaults.js';

import Logger from '../logger/logger.service.js';

export default class Config {
  constructor(config = {}) {
    this.log = Logger.log;

    // not known by camera.ui, so it is dropped by ConfigSetup
    const disableCameraUi = Boolean(config.disableCameraUi);
    let videoProcessor = config.options?.videoProcessor;

    // the video processor is saved to config.json, so it can point to the ffmpeg of an uninstalled plugin
    if (videoProcessor && path.isAbsolute(videoProcessor) && !fs.existsSync(videoProcessor)) {
      this.log.warn(`Video processor "${videoProcessor}" not found, using the included FFmpeg instead.`);
      videoProcessor = undefined;
    }

    // prefer the ffmpeg bundled with this plugin, the one bundled with camera.ui can no longer be downloaded
    config = new ConfigSetup({
      ...config,
      options: { ...config.options, videoProcessor: videoProcessor || ffmpegPath },
    });
    config.disableCameraUi = disableCameraUi;
    config.cameras = config.cameras
      .map((camera) => {
        if (!camera.name) {
          this.log.warn('The name for this camera is missing, the camera will be ignored.');
          return;
        }

        if (!camera.videoConfig?.source) {
          this.log.warn('The source for this camera is missing, the camera will be ignored.', camera.name);
          return;
        }

        const sourceArguments = camera.videoConfig.source.split(/\s+/);

        if (!sourceArguments.includes('-i')) {
          this.log.warn('The source for this camera is missing "-i", it is likely misconfigured.', camera.name);
          camera.videoConfig.source = false;
        }

        if (camera.videoConfig.stillImageSource) {
          const stillArguments = camera.videoConfig.stillImageSource.split(/\s+/);
          if (!stillArguments.includes('-i')) {
            this.log.warn(
              'The stillImageSource for this camera is missing "-i", it is likely misconfigured.',
              camera.name
            );
            camera.videoConfig.stillImageSource = camera.videoConfig.source;
          }
        } else {
          camera.videoConfig.stillImageSource = camera.videoConfig.source;
        }

        if (camera.videoConfig.subSource) {
          const stillArguments = camera.videoConfig.subSource.split(/\s+/);
          if (!stillArguments.includes('-i')) {
            this.log.warn('The subSource for this camera is missing "-i", it is likely misconfigured.', camera.name);
            camera.videoConfig.subSource = camera.videoConfig.source;
          }
        } else {
          camera.videoConfig.subSource = camera.videoConfig.source;
        }

        camera.motionTimeout =
          camera.motionTimeout === undefined || !(camera.motionTimeout >= 0) ? 15 : camera.motionTimeout;

        camera.motionDelay = camera.motionDelay && camera.motionDelay <= 10 ? camera.motionDelay : undefined;

        // validate prebufferLength
        camera.prebufferLength =
          camera.prebufferLength >= 4 && camera.prebufferLength <= 8 ? camera.prebufferLength : 4;

        return camera;
      })
      .filter(Boolean);

    return config;
  }
}
