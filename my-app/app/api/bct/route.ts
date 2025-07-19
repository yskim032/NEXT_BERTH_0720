import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

async function fetchFrameContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      console.warn(`Warning: Failed to fetch frame content from ${url}: ${response.status} ${response.statusText}`);
      return `Error loading frame content from ${url}: ${response.status} ${response.statusText}`;
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching frame content from ${url}:`, error);
    return `Error loading frame content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function GET() {
  let browser;
  try {
    console.log('Starting API request...');
    
    // Playwright 브라우저 설정
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }).catch(error => {
      console.error('Browser launch error:', error);
      throw new Error(`Browser launch failed: ${error.message}`);
    });

    console.log('Creating browser context...');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    }).catch(error => {
      console.error('Context creation error:', error);
      throw new Error(`Browser context creation failed: ${error.message}`);
    });

    console.log('Creating new page...');
    const page = await context.newPage().catch(error => {
      console.error('Page creation error:', error);
      throw new Error(`Page creation failed: ${error.message}`);
    });
    
    // 페이지 로딩 및 JavaScript 실행 대기
    console.log('Navigating to page...');
    await page.goto('https://info.bct2-4.com/infoservice/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }).catch(error => {
      console.error('Navigation error:', error);
      throw new Error(`Page navigation failed: ${error.message}`);
    });

    console.log('Waiting for initial load...');
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(error => {
      console.error('Load state error:', error);
      throw new Error(`Page load failed: ${error.message}`);
    });

    console.log('Waiting for JavaScript execution...');
    await page.waitForTimeout(10000);

    // 선석 배정현황(목록) 버튼 찾기
    console.log('Looking for berth assignment button...');
    const berthButton = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div'));
      console.log('Total div elements found:', elements.length);
      
      const berthElements = elements.filter(el => {
        const text = el.textContent?.trim() || '';
        return text === '선석 배정현황 (목록)';
      });
      
      console.log('Berth elements found:', berthElements.length);
      return berthElements.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        text: el.textContent?.trim(),
        html: el.outerHTML,
        style: el.getAttribute('style'),
        parentHTML: el.parentElement?.outerHTML,
        attributes: Array.from(el.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      }));
    });

    // 버튼 클릭 시도
    console.log('Attempting to click the berth assignment button...');
    try {
      // 정확한 버튼 선택자 사용
      const button = await page.locator('#mainframe_vframeset_hframeset_leftframe_form_grd_menu_body_gridrow_1_cell_1_0_controltreeTextBoxElement div').first();
      const isVisible = await button.isVisible();
      console.log('Button visibility:', isVisible);

      if (isVisible) {
        // 버튼 클릭
        await button.click();
        console.log('Button clicked successfully');
        
        // 클릭 후 데이터 로딩 대기
        console.log('Waiting for dynamic data to load...');
        await page.waitForTimeout(5000);

        // 동적 데이터 수집
        console.log('Collecting dynamic data after click...');
        const dynamicData = await page.evaluate(() => {
          // 선박 정보 추출
          const vesselInfo = Array.from(document.querySelectorAll('div[id^="mainframe_vframeset_hframeset_bodyframe_workframe_IST010_form_div_work_div_background_Grid00_body_gridrow_"]')).map(row => {
            const cells = Array.from(row.querySelectorAll('div[id$="GridCellTextContainerElement"] div')).map(cell => cell.textContent?.trim());
            
            // 필요한 정보 추출
            return {
              berth: cells[0] || '', // 선석 번호
              berthType: cells[1] || '', // 선석 타입 (예: 1(S))
              carrier: cells[2] || '', // 선사 (예: MSC)
              vesselCode: cells[3] || '', // 선박 코드 (예: MSCA001)
              vesselName: `${cells[4] || ''}/${cells[5] || ''}`, // 선박명 (예: QM516A/QM516A)
              arrivalTime: cells[7] || '', // 입항 시간 (예: 2025-05-09 22:00)
              departureTime: cells[8] || '', // 출항 시간 (예: 2025-05-11 17:00)
              vesselFullName: cells[12] || '', // 선박 전체 이름 (예: MSC CAMEROON)
              vesselType: cells[13] || '', // 선박 타입 (예: MEXICA)
              status: cells[16] || '' // 상태 (예: Working)
            };
          });

          // 테이블 헤더 정보 수집
          const tableHeaders = Array.from(document.querySelectorAll('table')).map(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => ({
              text: th.textContent?.trim(),
              html: th.outerHTML,
              style: th.getAttribute('style'),
              className: th.className
            }));
            return {
              tableId: table.id,
              tableClassName: table.className,
              headers
            };
          });

          // 특정 헤더를 포함하는 테이블 찾기
          const targetHeaders = ['모선명', '선사', '입항', '출항', '접안예정시간', '출항예정시간'];
          const targetTable = tableHeaders.find(table => 
            table.headers.some(header => 
              targetHeaders.some(target => header.text?.includes(target))
            )
          );

          // 모든 테이블 데이터 수집
          const tables = Array.from(document.querySelectorAll('table')).map(table => {
            const rows = Array.from(table.querySelectorAll('tr')).map(tr => {
              const cells = Array.from(tr.querySelectorAll('td, th')).map(cell => ({
                text: cell.textContent?.trim(),
                html: cell.outerHTML,
                style: cell.getAttribute('style'),
                className: cell.className
              }));
              return {
                cells,
                html: tr.outerHTML,
                style: tr.getAttribute('style'),
                className: tr.className
              };
            });
            return {
              id: table.id,
              className: table.className,
              rows,
              html: table.outerHTML
            };
          });

          // 모든 div 데이터 수집 (특히 동적으로 생성된 컨텐츠)
          const divs = Array.from(document.querySelectorAll('div')).map(div => ({
            id: div.id,
            className: div.className,
            text: div.textContent?.trim(),
            style: div.getAttribute('style'),
            html: div.outerHTML,
            parentId: div.parentElement?.id,
            parentClassName: div.parentElement?.className
          }));

          // 특정 ID를 가진 요소들 수집
          const specificElements = {
            mainBackButtonEvent: document.getElementById('main_backButtonEvent')?.outerHTML,
            mainframeVframeset: document.getElementById('mainframe_vframeset')?.outerHTML,
            mainframeVframesetTopframe: document.getElementById('mainframe_vframeset_topframe')?.outerHTML,
            mainframeVframesetTopframeForm: document.getElementById('mainframe_vframeset_topframe_form')?.outerHTML
          };

          // 모든 입력 필드 수집
          const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
            type: input.type,
            id: input.id,
            name: input.name,
            value: input.value,
            html: input.outerHTML,
            style: input.getAttribute('style'),
            className: input.className
          }));

          // 모든 선택 필드 수집
          const selects = Array.from(document.querySelectorAll('select')).map(select => ({
            id: select.id,
            name: select.name,
            options: Array.from(select.options).map(option => ({
              value: option.value,
              text: option.text,
              selected: option.selected
            })),
            html: select.outerHTML,
            style: select.getAttribute('style'),
            className: select.className
          }));

          // 현재 페이지의 모든 iframe 수집
          const iframes = Array.from(document.querySelectorAll('iframe')).map(iframe => ({
            id: iframe.id,
            src: iframe.src,
            name: iframe.name,
            html: iframe.outerHTML
          }));

          return {
            tables,
            tableHeaders,
            targetTable,
            vesselInfo,
            divs,
            specificElements,
            inputs,
            selects,
            iframes,
            pageTitle: document.title,
            url: window.location.href
          };
        });

        // 결과에 동적 데이터 추가
        const result = {
          main: await page.content(),
          analysis: {
            hasFrames: (await page.content()).includes('<frame') || (await page.content()).includes('<iframe'),
            frameCount: ((await page.content()).match(/<frame/g) || []).length + ((await page.content()).match(/<iframe/g) || []).length,
            frameTags: (await page.content()).match(/<frame[^>]*>|<iframe[^>]*>/g) || []
          },
          frames: {},
          dynamicElements: {},
          berthButton: berthButton,
          dynamicContent: dynamicData,
          clickSuccess: true
        };

        console.log('API request completed successfully');
        console.log('Dynamic data collected successfully');
        console.log('Target table found:', dynamicData.targetTable ? 'Yes' : 'No');
        if (dynamicData.targetTable) {
          console.log('Headers found:', dynamicData.targetTable.headers.map(h => h.text));
        }
        console.log('Vessel info found:', dynamicData.vesselInfo.length);
        if (dynamicData.vesselInfo.length > 0) {
          console.log('First vessel info:', dynamicData.vesselInfo[0]);
        }
        return NextResponse.json(result);
      } else {
        console.log('Button is not visible');
        const result = {
          main: await page.content(),
          analysis: {
            hasFrames: (await page.content()).includes('<frame') || (await page.content()).includes('<iframe'),
            frameCount: ((await page.content()).match(/<frame/g) || []).length + ((await page.content()).match(/<iframe/g) || []).length,
            frameTags: (await page.content()).match(/<frame[^>]*>|<iframe[^>]*>/g) || []
          },
          frames: {},
          dynamicElements: {},
          berthButton: berthButton,
          dynamicContent: null,
          clickSuccess: false,
          clickError: 'Button is not visible'
        };
        return NextResponse.json(result);
      }
    } catch (error) {
      console.error('Button click error:', error);
      const result = {
        main: await page.content(),
        analysis: {
          hasFrames: (await page.content()).includes('<frame') || (await page.content()).includes('<iframe'),
          frameCount: ((await page.content()).match(/<frame/g) || []).length + ((await page.content()).match(/<iframe/g) || []).length,
          frameTags: (await page.content()).match(/<frame[^>]*>|<iframe[^>]*>/g) || []
        },
        frames: {},
        dynamicElements: {},
        berthButton: berthButton,
        dynamicContent: null,
        clickSuccess: false,
        clickError: error instanceof Error ? error.message : 'Unknown error'
      };
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch content',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
} 