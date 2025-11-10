// client/src/services/device-manager.ts
import { machineIdSync } from 'node-machine-id';
import { networkInterfaces } from 'os';
import crypto from 'crypto';
import SecureStorage from './secure-storage';

/**
 * 기기 인증 관리자
 *
 * 기능:
 * - 기기 고유 ID 생성 (하드웨어 시리얼, MAC 주소, OS 정보 조합)
 * - 기기 ID 로컬 저장 및 조회
 * - 기기 등록 및 검증
 */
class DeviceManager {
  /**
   * 기기 고유 ID 생성
   *
   * 조합 요소:
   * 1. 하드웨어 시리얼 번호 (machine-id)
   * 2. MAC 주소 (첫 번째 실제 네트워크 인터페이스)
   * 3. OS 정보 (플랫폼 + 아키텍처)
   *
   * @returns SHA-256 해시된 기기 ID
   */
  generateDeviceId(): string {
    try {
      // 1. 하드웨어 시리얼 번호 (Windows: MachineGuid, macOS: IOPlatformUUID)
      const machineId = machineIdSync(true); // true = 원본 값 (해시 안 함)

      // 2. MAC 주소 (첫 번째 실제 네트워크 인터페이스)
      const nets = networkInterfaces();
      const mac = Object.values(nets)
        .flat()
        .find(net => net && !net.internal && net.mac !== '00:00:00:00:00:00')
        ?.mac || 'unknown-mac';

      // 3. OS 정보
      const platform = process.platform; // 'win32', 'darwin', 'linux'
      const arch = process.arch;         // 'x64', 'arm64'
      const osInfo = `${platform}-${arch}`;

      // 4. 조합하여 SHA-256 해시
      const combined = `${machineId}-${mac}-${osInfo}`;
      const hash = crypto.createHash('sha256').update(combined).digest('hex');

      return hash;
    } catch (error) {
      console.error('[DeviceManager] Failed to generate device ID:', error);
      throw new Error('기기 ID 생성 실패');
    }
  }

  /**
   * 현재 기기 ID 가져오기
   *
   * 1. 로컬 저장소에서 조회
   * 2. 없으면 새로 생성하여 저장
   *
   * @returns 기기 ID
   */
  async getDeviceId(): Promise<string> {
    try {
      // 로컬에 저장된 기기 ID 조회
      let deviceId = SecureStorage.getDeviceId();

      if (!deviceId) {
        // 없으면 새로 생성
        deviceId = this.generateDeviceId();
        SecureStorage.setDeviceId(deviceId);
        console.log('[DeviceManager] New device ID generated and saved');
      }

      return deviceId;
    } catch (error) {
      console.error('[DeviceManager] Failed to get device ID:', error);
      throw error;
    }
  }

  /**
   * 기기 이름 생성 (사용자 친화적)
   *
   * 예시:
   * - "Windows PC (DESKTOP-ABC123)"
   * - "MacBook Pro"
   * - "Linux Workstation"
   *
   * @returns 기기 이름
   */
  generateDeviceName(): string {
    const hostname = require('os').hostname();
    const platform = process.platform;

    let deviceType = 'Unknown Device';

    switch (platform) {
      case 'win32':
        deviceType = 'Windows PC';
        break;
      case 'darwin':
        deviceType = 'MacBook'; // 또는 "Mac"
        break;
      case 'linux':
        deviceType = 'Linux Workstation';
        break;
    }

    return `${deviceType} (${hostname})`;
  }

  /**
   * 로컬 저장소에서 기기 ID 제거
   *
   * 사용 시나리오:
   * - 로그아웃 시
   * - 기기 초기화
   */
  clearDeviceId(): void {
    try {
      SecureStorage.clearDeviceId();
      console.log('[DeviceManager] Device ID cleared');
    } catch (error) {
      console.error('[DeviceManager] Failed to clear device ID:', error);
    }
  }
}

export default new DeviceManager();
