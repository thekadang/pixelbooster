// scripts/generate-temp-icon.js
// 임시 아이콘 생성 스크립트 (개발용)

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG 텍스트 생성
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- 그라데이션 배경 -->
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 배경 원 -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)" />

  <!-- 텍스트 PB -->
  <text
    x="50%"
    y="50%"
    font-family="Arial, sans-serif"
    font-size="${size * 0.35}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
  >PB</text>

  <!-- 하단 작은 텍스트 -->
  <text
    x="50%"
    y="${size * 0.82}"
    font-family="Arial, sans-serif"
    font-size="${size * 0.12}"
    font-weight="normal"
    fill="white"
    text-anchor="middle"
    opacity="0.9"
  >BETA</text>
</svg>
`;

async function generateIcons() {
  const buildDir = path.join(__dirname, '..', 'build');

  // build 폴더 생성
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  console.log('🎨 임시 아이콘 생성 중...\n');

  try {
    // 1. PNG 생성 (512x512) - Linux용
    console.log('📦 icon.png 생성 중... (512x512)');
    const svg512 = Buffer.from(createIconSVG(512));
    await sharp(svg512)
      .png()
      .toFile(path.join(buildDir, 'icon.png'));
    console.log('✅ icon.png 생성 완료\n');

    // 2. ICO 생성 (256x256) - Windows용
    console.log('📦 icon.ico 생성 중... (256x256)');
    const svg256 = Buffer.from(createIconSVG(256));

    // ICO는 여러 크기를 포함해야 하므로 256x256으로 생성 후 electron-builder가 처리
    await sharp(svg256)
      .resize(256, 256)
      .toFormat('png')
      .toFile(path.join(buildDir, 'icon-256.png'));

    // PNG를 ICO로 변환 (electron-builder가 자동 처리하지만 기본 파일 제공)
    await sharp(svg256)
      .resize(256, 256)
      .toFormat('png')
      .toFile(path.join(buildDir, 'icon.ico.png'));

    // 실제 ICO 파일은 electron-builder가 자동 생성하지만,
    // 임시로 256x256 PNG를 ico로 rename
    fs.copyFileSync(
      path.join(buildDir, 'icon-256.png'),
      path.join(buildDir, 'icon.ico')
    );

    console.log('✅ icon.ico 생성 완료 (임시: PNG 기반)\n');

    // 3. 추가 크기 PNG 생성 (다양한 해상도)
    const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

    console.log('📦 다양한 크기 PNG 생성 중...');
    for (const size of sizes) {
      const svgBuffer = Buffer.from(createIconSVG(size));
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(buildDir, `icon-${size}.png`));
      console.log(`   ✓ icon-${size}.png`);
    }

    console.log('\n✨ 모든 아이콘 생성 완료!\n');
    console.log('📁 생성 위치: build/');
    console.log('   - icon.png (Linux)');
    console.log('   - icon.ico (Windows, 임시)');
    console.log('   - icon-*.png (다양한 크기)\n');
    console.log('⚠️  주의: macOS icon.icns는 macOS에서 생성해야 합니다.');
    console.log('   또는 온라인 도구 (cloudconvert.com) 사용\n');
    console.log('🎯 프로덕션 배포 전 실제 디자인된 아이콘으로 교체하세요!');

  } catch (error) {
    console.error('❌ 아이콘 생성 실패:', error.message);
    process.exit(1);
  }
}

// 실행
generateIcons();
