import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const STARTDATE = formData.get('STARTDATE') as string;
    const ENDDATE = formData.get('ENDDATE') as string;

    const response = await axios.get('https://www.pnitl.com/infoservice/vessel/vslScheduleList.jsp', {
      params: {
        STARTDATE,
        ENDDATE
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('PNIT 데이터 추출 중 오류 발생:', error);
    return NextResponse.json(
      { error: 'PNIT 데이터를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
} 