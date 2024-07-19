import { instance } from "../global/instance";

export class WuttheringWaveAPI {
  async getResonatorName() {
    const data = await instance.get(`/characters`);
    return data.data;
  }
  async getResonatorData(name: string) {
    const data = await instance.get(`/characters/${name}`);
    return data.data;
  }
  async getResonatorLogo(name: string) {
    const data = await instance.get(
      `/characters${name ? `/${name}/circle` : ""}`
    );
    return data.data;
  }
}
