'use client';

interface Vessel {
  vesselName: string;
  vesselFullName: string;
  vesselType: string;
  arrivalTime: string;
  departureTime: string;
  carrier: string;
  routeCode: string;
  portInfo: string;
}


import axios from 'axios';
import * as cheerio from 'cheerio';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface VesselData {
  terminal: string;
  vesselName: string;
  routeCode?: string;
  carrier: string;
  portInfo: string;
  arrivalTime: string;
  departureTime: string;
}

interface TerminalFilter {
  PNC: boolean;
  GWCT: boolean;
  ICT: boolean;
  PNIT: boolean;
  BCT: boolean;
  HJNC: boolean;
}

const REFRESH_INTERVALS = [
  { value: 30, label: '30초' },
  { value: 60, label: '1분' },
  { value: 600, label: '10분' },
  { value: 1800, label: '30분' },
  { value: 3600, label: '1시간' }
];

const isValidVesselName = (name: string): boolean => {
  // 알파벳, 공백, 하이픈, 점만 허용
  return /^[A-Za-z\s\-\.]+$/.test(name);
};

const getDayOfWeek = (dateString: string): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateString);
  return days[date.getDay()];
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

export default function TestPage() {
  const [pncVessels, setPncVessels] = useState<VesselData[]>([]);
  const [gwctVessels, setGwctVessels] = useState<VesselData[]>([]);
  const [ictVessels, setIctVessels] = useState<VesselData[]>([]);
  const [pnitVessels, setPnitVessels] = useState<VesselData[]>([]);
  const [bctVessels, setBctVessels] = useState<VesselData[]>([]);
  const [hjncVessels, setHjncVessels] = useState<VesselData[]>([]);
  const [startDate, setStartDate] = useState('20250504');
  const [endDate, setEndDate] = useState('20250511');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminalFilter, setTerminalFilter] = useState<TerminalFilter>({
    PNC: true,
    GWCT: true,
    ICT: true,
    PNIT: true,
    BCT: true,
    HJNC: true
  });
  const [showDayOfWeek, setShowDayOfWeek] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(600); // 기본 10분
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [nextRefreshTime, setNextRefreshTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  useEffect(() => {
    if (lastRefreshTime) {
      const nextTime = new Date(lastRefreshTime.getTime() + refreshInterval * 1000);
      setNextRefreshTime(nextTime);
    }
  }, [lastRefreshTime, refreshInterval]);

  const fetchData = async (start = startDate, end = endDate) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('STARTDATE', start);
      formData.append('ENDDATE', end);

      // PNC 데이터 가져오기
      const pncResponse = await axios.post('/api/pnc', formData);
      const $pnc = cheerio.load(pncResponse.data);
      const newPncVessels: VesselData[] = [];

      $pnc('tbody tr').each((index, element) => {
        const $row = $pnc(element);
        const vesselName = $row.find('td').eq(1).text().trim();
        
        if (isValidVesselName(vesselName)) {
          const vessel: VesselData = {
            terminal: 'PNC',
            vesselName,
            routeCode: $row.find('td').eq(3).text().trim(),
            carrier: $row.find('td').eq(4).text().trim(),
            portInfo: $row.find('td').eq(5).find('a').text().trim(),
            arrivalTime: $row.find('td').eq(7).text().trim(),
            departureTime: $row.find('td').eq(8).text().trim()
          };
          newPncVessels.push(vessel);
        }
      });

      // GWCT 데이터 가져오기
      const gwctResponse = await axios.post('/api/gwct', formData);
      const newGwctVessels: VesselData[] = gwctResponse.data.filter((vessel: VesselData) => 
        isValidVesselName(vessel.vesselName)
      );

      // ICT 데이터 가져오기
      const ictResponse = await axios.post('/api/ict', formData);
      const $ict = cheerio.load(ictResponse.data);
      const newIctVessels: VesselData[] = [];

      $ict('tr[align="center"]').each((index, element) => {
        const $row = $ict(element);
        const vesselName = $row.find('td').eq(4).text().trim();
        
        if (isValidVesselName(vesselName)) {
          const vessel: VesselData = {
            terminal: 'ICT',
            vesselName,
            routeCode: $row.find('td').eq(3).text().trim().match(/\((.*?)\)/)?.[1] || '',
            carrier: $row.find('td').eq(1).text().trim(),
            portInfo: $row.find('td').eq(1).text().trim(),
            arrivalTime: $row.find('td').eq(5).text().trim(),
            departureTime: $row.find('td').eq(6).text().trim()
          };
          newIctVessels.push(vessel);
        }
      });

      // PNIT 데이터 가져오기
      const pnitResponse = await axios.post('/api/pnit', formData);
      const $pnit = cheerio.load(pnitResponse.data);
      const newPnitVessels: VesselData[] = [];

      $pnit('tr[class^="color_"]').each((index, element) => {
        const $row = $pnit(element);
        const vesselName = $row.find('td').eq(5).text().trim();
        
        if (isValidVesselName(vesselName)) {
          const vessel: VesselData = {
            terminal: 'PNIT',
            vesselName,
            routeCode: $row.find('td').eq(3).text().trim(),
            carrier: $row.find('td').eq(1).text().trim(),
            portInfo: $row.find('td').eq(6).text().trim(),
            arrivalTime: $row.find('td').eq(8).text().trim(),
            departureTime: $row.find('td').eq(9).text().trim()
          };
          newPnitVessels.push(vessel);
        }
      });

      // BCT 데이터 가져오기
      const bctResponse = await axios.get('/api/bct');
      const newBctVessels: VesselData[] = bctResponse.data.dynamicContent.vesselInfo
        .filter((vessel: Vessel) => vessel.vesselFullName && vessel.vesselName)
        .filter((vessel: Vessel, index: number, self: Vessel[]) => 
          index === self.findIndex(v => 
            v.vesselFullName === vessel.vesselFullName && 
            v.vesselName === vessel.vesselName
          )
        )
        .map((vessel: Vessel) => ({
          terminal: 'BCT',
          vesselName: vessel.vesselFullName,
          routeCode: vessel.vesselName,
          carrier: vessel.carrier,
          portInfo: vessel.vesselType,
          arrivalTime: vessel.arrivalTime,
          departureTime: vessel.departureTime
        }));

      // HJNC 데이터 가져오기
      console.log('Fetching HJNC data...');
      try {
        const hjncResponse = await axios.post('/api/hjnc', formData);
        console.log('HJNC raw response:', hjncResponse.data);

        const newHjncVessels: VesselData[] = hjncResponse.data
          .filter((vessel: Vessel) => {
            const isValid = vessel.vesselName && vessel.vesselName.trim() !== '';
            if (!isValid) {
              console.log('Filtered out vessel:', vessel);
            }
            return isValid;
          })
          .map((vessel: Vessel) => {
            const mappedVessel = {
              terminal: 'HJNC',
              vesselName: vessel.vesselName,
              routeCode: vessel.routeCode,
              carrier: vessel.carrier,
              portInfo: vessel.portInfo,
              arrivalTime: vessel.arrivalTime,
              departureTime: vessel.departureTime
            };
            console.log('Mapped vessel:', mappedVessel);
            return mappedVessel;
          })
          .filter((vessel: VesselData) => {
            const isValid = vessel.vesselName && 
                           vessel.routeCode && 
                           vessel.carrier && 
                           vessel.portInfo && 
                           vessel.arrivalTime && 
                           vessel.departureTime;
            if (!isValid) {
              console.log('Filtered out mapped vessel:', vessel);
            }
            return isValid;
          });

        console.log('HJNC vessels processed:', newHjncVessels.length);
        if (newHjncVessels.length > 0) {
          console.log('Sample HJNC vessel:', newHjncVessels[0]);
        }

        setPncVessels(newPncVessels);
        setGwctVessels(newGwctVessels);
        setIctVessels(newIctVessels);
        setPnitVessels(newPnitVessels);
        setBctVessels(newBctVessels);
        setHjncVessels(newHjncVessels);
        setLastRefreshTime(new Date());
      } catch (error) {
        console.error('Error fetching HJNC data:', error);
        setError('HJNC 데이터를 가져오는 데 실패했습니다.');
      }
    } catch (error) {
      console.error('데이터 추출 중 오류 발생:', error);
      setError('데이터를 가져오는 데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchData(startDate, endDate);
  };

  const isMSC = (carrier: string) => {
    return carrier.includes('MSC');
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.toDateString() === today.toDateString();
  };

  const getCellStyle = (vessel: VesselData, field: keyof VesselData) => {
    if (isMSC(vessel.carrier) && ['vesselName', 'routeCode', 'carrier', 'portInfo'].includes(field)) {
      return 'bg-yellow-200';
    }
    if (['arrivalTime', 'departureTime'].includes(field) && vessel[field] && isToday(vessel[field])) {
      if (isMSC(vessel.carrier)) {
        return 'bg-yellow-200 text-purple-600';
      }
      return 'bg-purple-600 text-yellow-300';
    }
    return '';
  };

  const getAllVessels = () => {
    let allVessels: VesselData[] = [];
    
    if (terminalFilter.PNC) allVessels = [...allVessels, ...pncVessels];
    if (terminalFilter.GWCT) allVessels = [...allVessels, ...gwctVessels];
    if (terminalFilter.ICT) allVessels = [...allVessels, ...ictVessels];
    if (terminalFilter.PNIT) allVessels = [...allVessels, ...pnitVessels];
    if (terminalFilter.BCT) allVessels = [...allVessels, ...bctVessels];
    if (terminalFilter.HJNC) allVessels = [...allVessels, ...hjncVessels];
    
    return allVessels.sort((a, b) => {
      const dateA = new Date(a.arrivalTime);
      const dateB = new Date(b.arrivalTime);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const getTerminalColor = (terminal: string) => {
    switch (terminal) {
      case 'PNC':
        return 'bg-blue-100 text-blue-800';
      case 'GWCT':
        return 'bg-purple-100 text-purple-800';
      case 'ICT':
        return 'bg-pink-100 text-pink-800';
      case 'PNIT':
        return 'bg-emerald-100 text-emerald-800';
      case 'BCT':
        return 'bg-orange-100 text-orange-800';
      case 'HJNC':
        return 'bg-gray-100 text-gray-800';
      default:
        return '';
    }
  };

  const handleTerminalFilterChange = (terminal: keyof TerminalFilter) => {
    setTerminalFilter(prev => ({
      ...prev,
      [terminal]: !prev[terminal]
    }));
  };

  const formatDateTime = (dateString: string) => {
    if (!showDayOfWeek) return dateString;
    return `${dateString} (${getDayOfWeek(dateString)})`;
  };

  return (
    <div className="container mx-auto p-4">
      <Link href="/" className="text-blue-500 hover:underline">Home</Link>
      <h1 className="text-2xl font-bold mb-4">터미널 선박 입출항 정보</h1>
      
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">터미널 선택</h2>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.PNC}
              onChange={() => handleTerminalFilterChange('PNC')}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('PNC')}`}>PNC</span>
            </span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.GWCT}
              onChange={() => handleTerminalFilterChange('GWCT')}
              className="form-checkbox h-5 w-5 text-purple-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('GWCT')}`}>GWCT</span>
            </span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.ICT}
              onChange={() => handleTerminalFilterChange('ICT')}
              className="form-checkbox h-5 w-5 text-pink-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('ICT')}`}>ICT</span>
            </span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.PNIT}
              onChange={() => handleTerminalFilterChange('PNIT')}
              className="form-checkbox h-5 w-5 text-emerald-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('PNIT')}`}>PNIT</span>
            </span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.BCT}
              onChange={() => handleTerminalFilterChange('BCT')}
              className="form-checkbox h-5 w-5 text-orange-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('BCT')}`}>BCT</span>
            </span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={terminalFilter.HJNC}
              onChange={() => handleTerminalFilterChange('HJNC')}
              className="form-checkbox h-5 w-5 text-red-600"
            />
            <span className="ml-2">
              <span className={`px-2 py-1 rounded ${getTerminalColor('HJNC')}`}>HJNC</span>
            </span>
          </label>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">기능 설정</h2>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={showDayOfWeek}
              onChange={() => setShowDayOfWeek(!showDayOfWeek)}
              className="form-checkbox h-5 w-5 text-gray-600"
            />
            <span className="ml-2">요일 표시 기능</span>
          </label>
          <div className="w-full mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">자동 갱신 주기</label>
            <div className="flex flex-wrap gap-4">
              {REFRESH_INTERVALS.map((interval) => (
                <label key={interval.value} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="refreshInterval"
                    value={interval.value}
                    checked={refreshInterval === interval.value}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2">{interval.label}</span>
                </label>
              ))}
            </div>
          </div>
          {lastRefreshTime && nextRefreshTime && (
            <div className="w-full mt-4 text-sm text-gray-600">
              <p>마지막 갱신: {formatTime(lastRefreshTime)}</p>
              <p>다음 갱신: {formatTime(nextRefreshTime)}</p>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex items-center gap-4">
          <div>
            <input
              type="text"
              id="STARTDATE"
              name="STARTDATE"
              className="text cal w120 border rounded px-2 py-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="YYYYMMDD"
              pattern="[0-9]{8}"
              title="YYYYMMDD 형식으로 입력하세요 (예: 20250504)"
            />
          </div>
          <span>~</span>
          <div>
            <input
              type="text"
              id="ENDDATE"
              name="ENDDATE"
              className="text cal w120 border rounded px-2 py-1"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="YYYYMMDD"
              pattern="[0-9]{8}"
              title="YYYYMMDD 형식으로 입력하세요 (예: 20250511)"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
            disabled={isLoading}
          >
            {isLoading ? '로딩중...' : '검색'}
          </button>
        </div>
      </form>

      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      {isLoading ? (
        <div className="text-center py-4">데이터를 불러오는 중...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">터미널</th>
                <th className="px-4 py-2 border">선박명</th>
                <th className="px-4 py-2 border">항차</th>
                <th className="px-4 py-2 border">선사</th>
                <th className="px-4 py-2 border">서비스</th>
                <th className="px-4 py-2 border">ATB(ETB)</th>
                <th className="px-4 py-2 border">ATD(ETD)</th>
              </tr>
            </thead>
            <tbody>
              {getAllVessels().map((vessel, index) => (
                <tr 
                  key={index} 
                  className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <td className={`px-4 py-2 border ${getTerminalColor(vessel.terminal)}`}>
                    {vessel.terminal}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'vesselName')}`}>
                    {vessel.vesselName}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'routeCode')}`}>
                    {vessel.routeCode || '-'}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'carrier')}`}>
                    {vessel.carrier}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'portInfo')}`}>
                    {vessel.portInfo}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'arrivalTime')}`}>
                    {formatDateTime(vessel.arrivalTime)}
                  </td>
                  <td className={`px-4 py-2 border ${getCellStyle(vessel, 'departureTime')}`}>
                    {formatDateTime(vessel.departureTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

//test  2
