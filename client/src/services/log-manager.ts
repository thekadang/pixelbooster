// services/log-manager.ts - Excel 기반 작업 로그 관리

import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  LogEntry,
  LogIndex,
  BatchProcessProgress,
  Result,
} from '../types';

/**
 * LogManager - Excel 기반 작업 로그 관리
 *
 * 주요 기능:
 * - Excel 파일 생성 및 관리
 * - 배치 처리 결과 로그 추가
 * - 로그 이력 조회 및 필터링
 * - 통합 Excel 파일 내보내기
 *
 * @example
 * ```typescript
 * const logManager = new LogManager();
 * const result = await logManager.createLogFile();
 * if (result.success) {
 *   console.log('로그 파일 생성:', result.data);
 * }
 * ```
 */
export class LogManager {
  private logDir: string;
  private indexPath: string;

  constructor() {
    // logs 디렉토리 경로 (프로젝트 루트/logs)
    this.logDir = path.join(process.cwd(), 'logs');
    this.indexPath = path.join(this.logDir, 'log_index.json');
  }

  /**
   * logs 디렉토리 생성 (존재하지 않으면)
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error: any) {
      console.error('로그 디렉토리 생성 실패:', error);
    }
  }

  /**
   * 로그 파일명 생성
   *
   * @param date - 날짜 객체
   * @returns 파일명 (예: "2025-01-15_batch-log.xlsx")
   */
  private getLogFileName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}_batch-log.xlsx`;
  }

  /**
   * 압축률 계산
   *
   * @param inputSize - 원본 파일 크기 (bytes)
   * @param outputSize - 출력 파일 크기 (bytes)
   * @returns 압축률 (0-100%)
   */
  private calculateCompressionRatio(inputSize: number, outputSize: number): number {
    if (inputSize === 0) return 0;
    return ((inputSize - outputSize) / inputSize) * 100;
  }

  /**
   * 파일 크기 포맷팅
   *
   * @param bytes - 파일 크기 (bytes)
   * @returns 읽기 쉬운 문자열 (예: "5.00 MB")
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${size} ${units[i]}`;
  }

  /**
   * 로그 인덱스 로드
   *
   * @returns 로그 인덱스
   */
  private async loadIndex(): Promise<LogIndex> {
    try {
      const exists = await this.fileExists(this.indexPath);
      if (!exists) {
        // 인덱스 파일이 없으면 빈 인덱스 생성
        return {
          version: '1.0',
          lastUpdated: new Date(),
          totalLogs: 0,
          logs: [],
        };
      }

      const data = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(data);

      // Date 객체로 변환
      index.lastUpdated = new Date(index.lastUpdated);
      index.logs = index.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp),
      }));

      return index;
    } catch (error: any) {
      console.error('로그 인덱스 로드 실패:', error);
      return {
        version: '1.0',
        lastUpdated: new Date(),
        totalLogs: 0,
        logs: [],
      };
    }
  }

  /**
   * 로그 인덱스 업데이트
   *
   * @param logEntry - 추가할 로그 엔트리
   */
  private async updateIndex(logEntry: LogEntry): Promise<void> {
    try {
      const index = await this.loadIndex();

      // 새 로그 추가
      index.logs.push(logEntry);
      index.totalLogs = index.logs.length;
      index.lastUpdated = new Date();

      // 인덱스 저장
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error: any) {
      console.error('로그 인덱스 업데이트 실패:', error);
    }
  }

  /**
   * 파일 존재 확인
   *
   * @param filePath - 파일 경로
   * @returns 존재 여부
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 새 로그 파일 생성
   *
   * @param date - 로그 생성 일자 (기본값: 오늘)
   * @returns 생성된 파일 경로
   */
  async createLogFile(date: Date = new Date()): Promise<Result<string>> {
    try {
      // 1. logs 디렉토리 생성
      await this.ensureLogDirectory();

      // 2. 파일명 생성
      const fileName = this.getLogFileName(date);
      const filePath = path.join(this.logDir, fileName);

      // 3. 이미 파일이 존재하면 경로 반환
      const exists = await this.fileExists(filePath);
      if (exists) {
        return {
          success: true,
          data: filePath,
        };
      }

      // 4. ExcelJS Workbook 생성
      const workbook = new ExcelJS.Workbook();

      // 5. "작업 기록" 시트 추가
      const worksheet = workbook.addWorksheet('작업 기록');

      // 6. 헤더 설정
      worksheet.columns = [
        { header: '번호', key: 'id', width: 10 },
        { header: '작업 일시', key: 'timestamp', width: 20 },
        { header: '파일명', key: 'filename', width: 30 },
        { header: '원본 경로', key: 'inputPath', width: 50 },
        { header: '출력 경로', key: 'outputPath', width: 50 },
        { header: '원본 크기', key: 'inputSize', width: 15 },
        { header: '출력 크기', key: 'outputSize', width: 15 },
        { header: '압축률', key: 'compressionRatio', width: 12 },
        { header: '포맷', key: 'format', width: 10 },
        { header: '품질', key: 'quality', width: 10 },
        { header: '상태', key: 'status', width: 10 },
        { header: '에러 메시지', key: 'error', width: 40 },
        { header: '처리 시간', key: 'processingTime', width: 15 },
      ];

      // 7. 헤더 스타일 적용
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B46C1' }, // 보라색
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // 8. "통계" 시트 추가
      const statsSheet = workbook.addWorksheet('통계');
      statsSheet.mergeCells('A1:B1');
      statsSheet.getCell('A1').value = '📊 전체 통계';
      statsSheet.getCell('A1').font = { bold: true, size: 14 };
      statsSheet.getCell('A1').alignment = { horizontal: 'center' };

      // 통계 템플릿
      statsSheet.addRow(['총 변환 파일', 0]);
      statsSheet.addRow(['성공', 0]);
      statsSheet.addRow(['실패', 0]);
      statsSheet.addRow(['평균 압축률', '0%']);
      statsSheet.addRow(['총 절약 용량', '0 MB']);

      // 9. 파일 저장
      await workbook.xlsx.writeFile(filePath);

      return {
        success: true,
        data: filePath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `로그 파일 생성 실패: ${error.message}`,
      };
    }
  }

  /**
   * 배치 처리 결과를 로그에 추가
   *
   * @param batchProgress - 배치 처리 결과
   * @param logFilePath - 로그 파일 경로 (옵션, 미제공 시 오늘 날짜 파일)
   * @returns 업데이트 결과
   */
  async appendBatchLog(
    batchProgress: BatchProcessProgress,
    logFilePath?: string
  ): Promise<Result<void>> {
    try {
      // 1. 로그 파일 경로 결정
      let filePath = logFilePath;
      if (!filePath) {
        const today = new Date();
        const fileName = this.getLogFileName(today);
        filePath = path.join(this.logDir, fileName);

        // 파일이 없으면 생성
        const exists = await this.fileExists(filePath);
        if (!exists) {
          const createResult = await this.createLogFile(today);
          if (!createResult.success) {
            return createResult;
          }
          filePath = createResult.data;
        }
      }

      // 2. Workbook 열기
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // 3. "작업 기록" 시트 가져오기
      const worksheet = workbook.getWorksheet('작업 기록');
      if (!worksheet) {
        return {
          success: false,
          error: '"작업 기록" 시트를 찾을 수 없습니다.',
        };
      }

      // 4. 순번 초기화 (1부터 시작)
      let sequentialId = 1;

      // 5. 각 파일 항목을 새 행으로 추가
      for (const item of batchProgress.items) {
        if (item.status !== 'completed' && item.status !== 'failed') {
          continue; // 완료 또는 실패한 항목만 로그
        }

        // 처리 시간 계산
        const processingTime = item.endTime && item.startTime
          ? item.endTime - item.startTime
          : 0;

        // 압축률 계산
        const compressionRatio = item.originalSize && item.convertedSize
          ? this.calculateCompressionRatio(item.originalSize, item.convertedSize)
          : 0;

        // 로그 엔트리 생성
        const logEntry: LogEntry = {
          id: sequentialId, // 순번 사용 (컬럼 인덱스 아님)
          timestamp: new Date(),
          filename: path.basename(item.inputPath),
          inputPath: item.inputPath,
          outputPath: item.outputPath,
          inputSize: item.originalSize || 0,
          outputSize: item.convertedSize || 0,
          compressionRatio,
          format: 'webp', // TODO: 실제 포맷 가져오기
          quality: 80, // TODO: 실제 품질 가져오기
          status: item.status === 'completed' ? 'success' : 'failed',
          error: item.error,
          processingTime,
        };

        // 행 추가
        const row = worksheet.addRow({
          id: logEntry.id,
          timestamp: logEntry.timestamp,
          filename: logEntry.filename,
          inputPath: logEntry.inputPath,
          outputPath: logEntry.outputPath,
          inputSize: this.formatFileSize(logEntry.inputSize),
          outputSize: this.formatFileSize(logEntry.outputSize),
          compressionRatio: `${logEntry.compressionRatio.toFixed(1)}%`,
          format: logEntry.format.toUpperCase(),
          quality: logEntry.quality,
          status: logEntry.status === 'success' ? '성공' : '실패',
          error: logEntry.error || '',
          processingTime: `${(logEntry.processingTime / 1000).toFixed(1)}초`,
        });

        // 하이퍼링크 추가 (원본 경로, 출력 경로)
        // 컬럼 번호로 직접 접근 (1-based index)
        // inputPath는 4번째 컬럼 (D), outputPath는 5번째 컬럼 (E)
        const inputPathCell = row.getCell(4);
        inputPathCell.value = {
          text: logEntry.inputPath,
          hyperlink: `file:///${logEntry.inputPath.replace(/\\/g, '/')}`,
        };
        inputPathCell.font = { color: { argb: 'FF0000FF' }, underline: true };

        const outputPathCell = row.getCell(5);
        outputPathCell.value = {
          text: logEntry.outputPath,
          hyperlink: `file:///${logEntry.outputPath.replace(/\\/g, '/')}`,
        };
        outputPathCell.font = { color: { argb: 'FF0000FF' }, underline: true };

        // 상태별 색상 적용
        // status는 11번째 컬럼 (K)
        const statusCell = row.getCell(11);
        if (logEntry.status === 'success') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF00FF00' }, // 녹색
          };
        } else {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF0000' }, // 빨간색
          };
        }

        // 인덱스 업데이트
        await this.updateIndex(logEntry);

        sequentialId++; // 다음 순번으로 증가
      }

      // 6. "통계" 시트 업데이트
      const statsSheet = workbook.getWorksheet('통계');
      if (statsSheet) {
        const totalFiles = batchProgress.total;
        const successCount = batchProgress.completed;
        const failedCount = batchProgress.failed;
        const totalInputSize = batchProgress.items.reduce(
          (sum, item) => sum + (item.originalSize || 0),
          0
        );
        const totalOutputSize = batchProgress.items.reduce(
          (sum, item) => sum + (item.convertedSize || 0),
          0
        );
        const averageCompressionRatio = totalInputSize > 0
          ? this.calculateCompressionRatio(totalInputSize, totalOutputSize)
          : 0;
        const totalSavedSize = totalInputSize - totalOutputSize;

        statsSheet.getCell('B2').value = totalFiles;
        statsSheet.getCell('B3').value = successCount;
        statsSheet.getCell('B4').value = failedCount;
        statsSheet.getCell('B5').value = `${averageCompressionRatio.toFixed(1)}%`;
        statsSheet.getCell('B6').value = this.formatFileSize(totalSavedSize);
      }

      // 7. 파일 저장
      await workbook.xlsx.writeFile(filePath);

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `로그 추가 실패: ${error.message}`,
      };
    }
  }

  /**
   * 로그 이력 조회
   *
   * @param startDate - 시작 일자 (옵션)
   * @param endDate - 종료 일자 (옵션)
   * @returns 로그 항목 배열
   */
  async getLogHistory(startDate?: Date, endDate?: Date): Promise<Result<LogEntry[]>> {
    try {
      // 1. 인덱스 로드
      const index = await this.loadIndex();

      // 2. 날짜 범위 필터링
      let logs = index.logs;
      if (startDate) {
        logs = logs.filter((log) => log.timestamp >= startDate);
      }
      if (endDate) {
        logs = logs.filter((log) => log.timestamp <= endDate);
      }

      // 3. 일시 순으로 정렬 (최신순)
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return {
        success: true,
        data: logs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `로그 조회 실패: ${error.message}`,
      };
    }
  }

  /**
   * 통합 Excel 파일로 내보내기
   *
   * @param startDate - 시작 일자
   * @param endDate - 종료 일자
   * @param outputPath - 출력 파일 경로
   * @returns 내보내기 결과
   */
  async exportToExcel(
    startDate: Date,
    endDate: Date,
    outputPath: string
  ): Promise<Result<void>> {
    try {
      // 1. 로그 이력 조회
      const logsResult = await this.getLogHistory(startDate, endDate);
      if (!logsResult.success) {
        return logsResult;
      }

      const logs = logsResult.data;

      // 2. 새 Workbook 생성
      const workbook = new ExcelJS.Workbook();

      // 3. "통합 작업 기록" 시트 추가
      const worksheet = workbook.addWorksheet('통합 작업 기록');

      // 4. 헤더 설정
      worksheet.columns = [
        { header: '번호', key: 'id', width: 10 },
        { header: '작업 일시', key: 'timestamp', width: 20 },
        { header: '파일명', key: 'filename', width: 30 },
        { header: '원본 경로', key: 'inputPath', width: 50 },
        { header: '출력 경로', key: 'outputPath', width: 50 },
        { header: '원본 크기', key: 'inputSize', width: 15 },
        { header: '출력 크기', key: 'outputSize', width: 15 },
        { header: '압축률', key: 'compressionRatio', width: 12 },
        { header: '포맷', key: 'format', width: 10 },
        { header: '품질', key: 'quality', width: 10 },
        { header: '상태', key: 'status', width: 10 },
        { header: '에러 메시지', key: 'error', width: 40 },
        { header: '처리 시간', key: 'processingTime', width: 15 },
      ];

      // 5. 헤더 스타일
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B46C1' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // 6. 데이터 추가
      logs.forEach((log) => {
        worksheet.addRow({
          id: log.id,
          timestamp: log.timestamp,
          filename: log.filename,
          inputPath: log.inputPath,
          outputPath: log.outputPath,
          inputSize: this.formatFileSize(log.inputSize),
          outputSize: this.formatFileSize(log.outputSize),
          compressionRatio: `${log.compressionRatio.toFixed(1)}%`,
          format: log.format.toUpperCase(),
          quality: log.quality,
          status: log.status === 'success' ? '성공' : '실패',
          error: log.error || '',
          processingTime: `${(log.processingTime / 1000).toFixed(1)}초`,
        });
      });

      // 7. "통계" 시트 추가
      const statsSheet = workbook.addWorksheet('통계');
      const totalFiles = logs.length;
      const successCount = logs.filter((log) => log.status === 'success').length;
      const failedCount = logs.filter((log) => log.status === 'failed').length;
      const totalInputSize = logs.reduce((sum, log) => sum + log.inputSize, 0);
      const totalOutputSize = logs.reduce((sum, log) => sum + log.outputSize, 0);
      const averageCompressionRatio = totalInputSize > 0
        ? this.calculateCompressionRatio(totalInputSize, totalOutputSize)
        : 0;
      const totalSavedSize = totalInputSize - totalOutputSize;

      statsSheet.mergeCells('A1:B1');
      statsSheet.getCell('A1').value = '📊 전체 통계';
      statsSheet.getCell('A1').font = { bold: true, size: 14 };
      statsSheet.getCell('A1').alignment = { horizontal: 'center' };

      statsSheet.addRow(['총 변환 파일', totalFiles]);
      statsSheet.addRow(['성공', successCount]);
      statsSheet.addRow(['실패', failedCount]);
      statsSheet.addRow(['평균 압축률', `${averageCompressionRatio.toFixed(1)}%`]);
      statsSheet.addRow(['총 절약 용량', this.formatFileSize(totalSavedSize)]);

      // 8. 파일 저장
      await workbook.xlsx.writeFile(outputPath);

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Excel 내보내기 실패: ${error.message}`,
      };
    }
  }
}
