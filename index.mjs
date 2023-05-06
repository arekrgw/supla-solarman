import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import ky from "ky-universal";
dotenv.config();

const API_URL = "https://globalapi.solarmanpv.com";
const APP_ID = process.env.APP_ID;
const API_KEY = process.env.API_KEY;
const PASSWORD = process.env.PASSWORD;
const EMAIL = process.env.EMAIL;
const DEVICE_SN = process.env.DEVICE_SN;
const baseDir = process.env.BASE_DIR;

if (!baseDir || !APP_ID || !API_KEY || !PASSWORD || !EMAIL) {
  throw new Error("invalid env vars");
}

const STATE_FILE = path.join(baseDir, "state.json");
const POWER_FILE = path.join(baseDir, "pvpower");
const ERROR_FILE = path.join(baseDir, "error.log");

async function getToken() {
  const resp = await ky
    .post(`${API_URL}/account/v1.0/token?appId=${APP_ID}`, {
      json: {
        password: PASSWORD,
        appSecret: API_KEY,
        email: EMAIL,
      },
    })
    .json();

  return resp.access_token;
}

async function getPower(token) {
  const resp = await ky
    .post(`${API_URL}/device/v1.0/currentData`, {
      json: {
        deviceSn: DEVICE_SN,
      },
      headers: {
        Authorization: `bearer ${token}`,
      },
    })
    .json();

  if (!resp.success) return false;

  return (
    (
      Number(resp.dataList.find((d) => d.key === "APo_t1")?.value) / 1000
    ).toFixed(2) || 0
  );
}

(async () => {
  let state = null;
  try {
    state = fs.readFileSync(STATE_FILE, "utf8");
  } catch {
    // pass
  }
  let token = null;

  if (!state) {
    token = await getToken();
  } else {
    token = state.token;
  }

  let power = await getPower(token);

  if (!power) {
    token = await getToken();
    power = await getPower(token);
  }

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      token,
    })
  );

  fs.writeFileSync(POWER_FILE, power);
})().catch((err) => {
  fs.appendFileSync(ERROR_FILE, `${err.toString()}\n${err.stack}`);
});
