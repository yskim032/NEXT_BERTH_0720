import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const startDate = formData.get('STARTDATE') as string;
    const endDate = formData.get('ENDDATE') as string;

    // GWCT 웹사이트에서 데이터를 가져옵니다
    const response = await axios.get('http://www.gwct.co.kr/e-service2/?m=B&s=2');
    const $ = cheerio.load(response.data);
    const vessels: any[] = [];

    // 테이블의 각 행을 파싱합니다
    $('table tr').each((index, element) => {
      const $row = $(element);
      const $cells = $row.find('td');
      
      if ($cells.length >= 15) { // 데이터가 있는 행만 처리
        const vessel = {
          terminal: 'GWCT',
          vesselName: $cells.eq(2).text().trim(),
          carrier: $cells.eq(4).text().trim(),
          portInfo: $cells.eq(14).find('a').text().trim(),
          arrivalTime: $cells.eq(5).text().trim(),
          departureTime: $cells.eq(6).text().trim()
        };
        vessels.push(vessel);
      }
    });

    return NextResponse.json(vessels);
  } catch (error) {
    console.error('GWCT 데이터 파싱 중 오류 발생:', error);
    return NextResponse.json(
      { error: 'GWCT 데이터를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
} 