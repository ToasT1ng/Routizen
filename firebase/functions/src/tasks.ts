import { CloudTasksClient } from "@google-cloud/tasks";
import type { AlarmEvent } from "@routizen/core";
import { CONFIG } from "./config.js";

const client = new CloudTasksClient();

export interface AlarmTaskPayload {
  instanceId: string;
  /** 상태머신 이벤트 또는 프리미엄 추가 알람 */
  kind: AlarmEvent | "EXTRA";
  /** EXTRA 일 때 표시할 슬롯 시각(로그용) */
  slot?: string;
}

/**
 * 특정 시각(epoch ms)에 onAlarmTask 를 호출하도록 Cloud Task 예약.
 * 정시 1회 콜백 — 폴링 없이 정확한 시각에 발화 (기획 3.3).
 */
export async function enqueueAlarmTask(payload: AlarmTaskPayload, fireAtMs: number): Promise<void> {
  const project = await client.getProjectId();
  const parent = client.queuePath(project, CONFIG.region, CONFIG.taskQueue);

  await client.createTask({
    parent,
    task: {
      scheduleTime: { seconds: Math.floor(fireAtMs / 1000) },
      httpRequest: {
        httpMethod: "POST",
        url: CONFIG.alarmTaskUrl,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        // Cloud Tasks → 함수 인증 (OIDC). SA 미설정 시 공개 함수로 호출.
        ...(CONFIG.taskInvokerSA
          ? { oidcToken: { serviceAccountEmail: CONFIG.taskInvokerSA } }
          : {}),
      },
    },
  });
}
