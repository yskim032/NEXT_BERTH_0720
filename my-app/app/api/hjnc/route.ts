import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    // HJNC 웹사이트에서 데이터를 가져옵니다
    const response = await axios.get('https://www.hjnc.co.kr/esvc/vessel/berthScheduleT');
    const $ = cheerio.load(response.data);
    const vessels: any[] = [];

    // 테이블의 각 행을 파싱합니다
    $('table tr').each((index, element) => {
      const $row = $(element);
      const $cells = $row.find('td');
      if ($cells.length >= 12) {
        const vessel = {
          terminal: 'HJNC',
          vesselName: $cells.eq(4).text().trim(),
          routeCode: $cells.eq(5).text().trim(),
          carrier: $cells.eq(7).text().trim(),
          portInfo: $cells.eq(2).find('a').text().trim(),
          arrivalTime: $cells.eq(8).text().trim(),
          departureTime: $cells.eq(9).text().trim(),
          status: $cells.eq(16).text().trim()
        };
        vessels.push(vessel);
      }
    });

    return NextResponse.json(vessels);
  } catch (error) {
    console.error('HJNC 데이터 파싱 중 오류 발생:', error);
    return NextResponse.json(
      { error: 'HJNC 데이터를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
} 