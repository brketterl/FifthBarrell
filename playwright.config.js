import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export default defineConfig({
  testDir:'./e2e', workers:1, reporter:'list', outputDir:'/tmp/fifth-barrel-browser-results',
  use:{baseURL:'http://127.0.0.1:3107',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'node server.js',url:'http://127.0.0.1:3107',env:{PORT:'3107',DB_PATH:`/tmp/fifth-barrel-browser-${randomUUID()}.sqlite`},reuseExistingServer:false}
});
