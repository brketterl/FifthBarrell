import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {buildReviewCatalog} from './review-catalog.js';
const reviewPath='/tmp/fifth-barrel-test-reviews-'+randomUUID()+'.json';
writeFileSync(reviewPath,JSON.stringify(buildReviewCatalog('BRAND,LABEL,EXPRESSION,RELEASE/BATCH,RELEASE YEAR,PROOF,AGE\n'+Array.from({length:30},(_,i)=>`TEST SOCIETY,TEST FLIGHT,,C${String(i).padStart(3,'0')},2023,100,8`).join('\n'))));
export default defineConfig({
  testDir:'./e2e', workers:1, reporter:'list', outputDir:'/tmp/fifth-barrel-browser-results',
  use:{baseURL:'http://127.0.0.1:3107',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'node server.js',url:'http://127.0.0.1:3107',env:{PORT:'3107',DB_PATH:`/tmp/fifth-barrel-browser-${randomUUID()}.sqlite`,REVIEW_CATALOG_PATH:reviewPath},reuseExistingServer:false}
});
