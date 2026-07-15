import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('🚀 Starting Drag and Drop and Immediate Wall Scan Integration Test...');
  
  const planPath = '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/test_floor_plan_1783620034694.png';
  const sheetPath = '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/test_elevation_sheet_1783620085316.png';
  
  const videoDir = '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/scratch/';
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 }
    }
  });
  
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  try {
    console.log('🔗 Navigating to localhost:5175/app...');
    await page.goto('http://localhost:5175/app');
    await sleep(2000);
    
    console.log('📤 Uploading test floor plan...');
    const inputPlan = await page.locator('input[type="file"]:not([multiple])').first();
    await inputPlan.setInputFiles(planPath);
    await sleep(2000);
    
    console.log('📌 Drawing crop boundary in modal...');
    const svg = await page.locator('svg.cursor-crosshair').first();
    const box = await svg.boundingBox();
    
    if (!box) throw new Error('Svg bounding box not found.');
    
    const points = [
      { x: box.x + box.width * 0.08, y: box.y + box.height * 0.08 },
      { x: box.x + box.width * 0.92, y: box.y + box.height * 0.08 },
      { x: box.x + box.width * 0.92, y: box.y + box.height * 0.92 },
      { x: box.x + box.width * 0.08, y: box.y + box.height * 0.92 },
    ];
    
    for (const p of points) {
      await page.mouse.click(p.x, p.y);
      await sleep(250);
    }
    await page.mouse.click(points[0].x, points[0].y);
    await sleep(800);
    
    console.log('💾 Confirming floor plan crop...');
    await page.click('button:has-text("確定して進む")');
    await sleep(2500);
    
    console.log('📸 Saving immediate wall scanning screenshot...');
    // この時点で、平面図の上に A面〜D面のバッジが表示されていなければならない
    await page.screenshot({ path: '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/scratch/6_immediate_walls_scanned.png' });
    
    console.log('📤 Uploading test elevation sheet...');
    const inputSheet = await page.locator('input[type="file"][multiple]').first();
    await inputSheet.setInputFiles(sheetPath);
    await sleep(3500);
    
    console.log('📌 Drawing custom polygon crop on elevation sheet to trigger D&D...');
    // インラインSheetCropperのSVG内で適当に多角形（A面部分）を囲み、ドラッグプレビューを表示させる
    const cropSvg = await page.locator('svg.cursor-crosshair').nth(1); // 2つ目のSVG
    const cropBox = await cropSvg.boundingBox();
    
    if (!cropBox) throw new Error('Elevation Svg bounding box not found.');
    
    const cropPts = [
      { x: cropBox.x + cropBox.width * 0.05, y: cropBox.y + cropBox.height * 0.2 },
      { x: cropBox.x + cropBox.width * 0.22, y: cropBox.y + cropBox.height * 0.2 },
      { x: cropBox.x + cropBox.width * 0.22, y: cropBox.y + cropBox.height * 0.75 },
      { x: cropBox.x + cropBox.width * 0.05, y: cropBox.y + cropBox.height * 0.75 },
    ];
    
    for (const p of cropPts) {
      await page.mouse.click(p.x, p.y);
      await sleep(250);
    }
    // 最初の点に戻って閉じる
    await page.mouse.click(cropPts[0].x, cropPts[0].y);
    await sleep(2500); // スナップ・データURL生成待ち
    
    console.log('📸 Saving draggable crop thumbnail state...');
    await page.screenshot({ path: '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/scratch/7_draggable_crop_state.png' });
    
    console.log('🖱️ Performing Drag & Drop of crop thumbnail onto Wall A (A面 badge)...');
    // ドラッグサムネイルを特定し、平面図上のA面バッジへドラッグ＆ドロップする
    const dragSource = await page.locator('img[alt="Drag to map"]').first();
    const dropTarget = await page.locator('circle').first(); // バッジのサークル
    
    await dragSource.dragTo(dropTarget);
    await sleep(3000);
    
    console.log('📸 Saving mapping state after drag and drop...');
    await page.screenshot({ path: '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/scratch/8_after_drag_and_drop_mapped.png' });
    
    console.log('✅ Integration test finished successfully!');
    
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    const video = page.video();
    const videoPath = video ? await video.path() : null;
    
    await context.close();
    await browser.close();
    
    if (videoPath && fs.existsSync(videoPath)) {
      const destPath = '/Users/koheioka/.gemini/antigravity-ide/brain/a0376778-0542-485a-9723-13dbf04f99ec/cad_to_perspective_demo.webm';
      fs.renameSync(videoPath, destPath);
      console.log(`🎥 New Drag-and-Drop demonstration video saved: ${destPath}`);
    }
  }
}

run();
