import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const STARTDATE = formData.get('STARTDATE') as string;
    const ENDDATE = formData.get('ENDDATE') as string;

    const response = await axios.post(
      'https://svc.pncport.com/info/CMS/Ship/Info.pnc',
      new URLSearchParams({
        mCode: 'MN014',
        STARTDATE,
        ENDDATE
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('API 요청 중 오류 발생:', error);
    return NextResponse.json(
      { error: '데이터를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
}

const isValidVesselName = (name: string): boolean => {
  // 알파벳, 공백, 하이픈, 점만 허용
  return /^[A-Za-z\s\-\.]+$/.test(name);
}; 