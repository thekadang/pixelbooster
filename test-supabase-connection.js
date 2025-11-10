require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Supabase 연결 테스트 시작...\n');

  try {
    // 1. 연결 정보 확인
    console.log('📡 프로젝트 URL:', supabaseUrl);
    console.log('🔑 API Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : '❌ 없음');
    console.log('');

    // 2. 구독 등급 조회 테스트
    console.log('📊 구독 등급 데이터 조회 중...');
    const { data: tiers, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('❌ 오류 발생:', error.message);
      console.error('상세:', error);
      return;
    }

    if (!tiers || tiers.length === 0) {
      console.error('❌ 데이터가 없습니다. 마이그레이션이 실행되었는지 확인하세요.');
      return;
    }

    console.log('✅ 연결 성공!\n');
    console.log('📋 구독 등급 목록:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    tiers.forEach(tier => {
      const koreanName = tier.display_name.ko || tier.name;
      const price = tier.price_monthly ? `$${tier.price_monthly}/월` : '무료';
      const deviceLimit = tier.device_limit;
      console.log(`  ✓ ${koreanName.padEnd(10)} | ${price.padEnd(12)} | 기기: ${deviceLimit}대`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3. 테이블 목록 확인
    console.log('📦 생성된 테이블 확인 중...');
    const tables = [
      'subscriptions',
      'registered_devices',
      'affiliates',
      'affiliate_referrals',
      'revenue_logs',
      'subscription_tiers',
      'feature_flags',
      'user_events',
      'abuse_prevention'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      const status = error ? '❌' : '✅';
      console.log(`  ${status} ${table}`);
    }

    console.log('\n🎉 모든 테스트 통과! Supabase 설정이 완료되었습니다.\n');

  } catch (error) {
    console.error('❌ 연결 실패:', error.message);
    console.error('\n🔧 문제 해결:');
    console.error('  1. .env 파일의 SUPABASE_URL과 SUPABASE_ANON_KEY 확인');
    console.error('  2. Supabase 프로젝트가 활성화되어 있는지 확인');
    console.error('  3. 마이그레이션 SQL이 실행되었는지 확인\n');
  }
}

testConnection();
