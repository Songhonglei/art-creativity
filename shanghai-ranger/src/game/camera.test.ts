import { describe, expect, it } from 'vitest';
import { CAMERA, CameraGesture, cameraSafeFraction, orbitPosition } from './camera';
import { rotatedBoxBounds } from './collision';

const touch = (id: number, x = 100, y = 100) => ({ id, x, y, type: 'touch', button: 0 });
const floor = () => 0;
const origin = { x: 0, y: 1.55, z: 0 };

describe('镜头与移动、战斗的手势隔离', () => {
  it('摇杆或按钮的另一根手指不能转动或结束场景手势', () => {
    const g = new CameraGesture(); g.begin(touch(2));
    const yaw = g.yaw;
    g.move(1, 500, 500, 1, 390); expect(g.yaw).toBe(yaw);
    expect(g.end(1)).toBeNull(); expect(g.active).toBe(true);
    g.move(2, 200, 100, 1, 390); expect(g.yaw).not.toBe(yaw);
    expect(g.end(2)).toBeNull(); expect(g.active).toBe(false);
  });
  it('慢速小步拖动按累计距离识别，不会变成攻击', () => {
    const g = new CameraGesture(); g.begin(touch(1)); const yaw = g.yaw;
    for (let x = 101; x < 130; x++) g.move(1, x, 100, 1, 390);
    expect(g.yaw).not.toBe(yaw); expect(g.end(1)).toBeNull();
  });
  it('轻点仍可攻击，右键轻点重击，右键拖动只环顾', () => {
    const g = new CameraGesture(); g.begin(touch(1)); g.move(1, 103, 101, 1, 390);
    expect(g.end(1)).toBe('attack');
    g.begin({ ...touch(2), type: 'mouse', button: 2 }); expect(g.end(2)).toBe('heavy');
    g.begin({ ...touch(3), type: 'mouse', button: 2 }); g.move(3, 130, 110, 1, 900);
    expect(g.end(3)).toBeNull();
  });
  it('双指缩放不旋转、不出招，任一手指先抬起都可继续环顾', () => {
    for (const first of [1, 2]) {
      const g = new CameraGesture(); g.begin(touch(1, 100)); g.begin(touch(2, 200));
      const yaw = g.yaw; g.move(2, 300, 100, 1, 390);
      expect(g.distance).toBeCloseTo(4.1); expect(g.yaw).toBe(yaw);
      expect(g.end(first)).toBeNull(); expect(g.count).toBe(1);
      const remaining = first === 1 ? 2 : 1, x = remaining === 2 ? 300 : 100;
      g.move(remaining, x + 1, 100, 1, 390); expect(g.yaw).toBe(yaw);
      g.move(remaining, x + 25, 100, 1, 390); expect(g.yaw).not.toBe(yaw);
      expect(g.end(remaining)).toBeNull();
    }
  });
  it('第三根场景手指与混入的鼠标不抢占缩放', () => {
    const g = new CameraGesture(); expect(g.begin(touch(1))).toBe(true);
    expect(g.begin({ ...touch(5), type: 'mouse' })).toBe(false);
    expect(g.begin(touch(2))).toBe(true); expect(g.begin(touch(3))).toBe(false);
    expect(g.end(3)).toBeNull(); expect(g.count).toBe(2);
  });
  it('取消、失焦、暂停后无残留手势或误攻击', () => {
    const g = new CameraGesture(); g.begin(touch(1)); expect(g.end(1, true)).toBeNull();
    g.begin(touch(2)); g.cancel(); const yaw = g.yaw;
    g.move(2, 300, 300, 1, 390); expect(g.yaw).toBe(yaw); expect(g.end(2)).toBeNull();
  });
  it('缩放和俯仰有边界，水平可持续环绕', () => {
    const g = new CameraGesture(); g.zoom(.001); expect(g.distance).toBe(CAMERA.minDistance);
    g.zoom(1e6); expect(g.distance).toBe(CAMERA.maxDistance);
    g.begin(touch(1)); g.move(1, 10000, 10000, 1, 390); expect(g.pitch).toBe(CAMERA.maxPitch);
    g.move(1, -10000, -10000, 1, 390); expect(g.pitch).toBe(CAMERA.minPitch);
    expect(Math.abs(g.yaw)).toBeLessThanOrEqual(Math.PI);
  });
  it('按视口尺度匹配手机横竖屏环顾，不依赖屏幕像素比', () => {
    const a = new CameraGesture(), b = new CameraGesture(); a.begin(touch(1)); b.begin(touch(1));
    a.move(1, 139, 100, 1, 390); b.move(1, 184.4, 100, 1, 844);
    expect(a.yaw).toBeCloseTo(b.yaw);
  });
  it('锁定时手动镜头优先，松手宽限后平滑跟回目标', () => {
    const g = new CameraGesture(); g.begin(touch(1)); g.move(1, 200, 100, 1, 390);
    const yaw = g.yaw; g.followLock(1, 2); expect(g.yaw).toBe(yaw);
    g.move(1, 210, 100, 1, 390); g.end(1); const released = g.yaw;
    g.followLock(1, .5); expect(g.yaw).toBe(released);
    g.followLock(1, 1.2); expect(g.yaw).not.toBe(released); expect(g.yaw).toBeLessThan(1);
  });
  it('长按环顾后松手仍有完整宽限时间', () => {
    const g = new CameraGesture(); g.begin(touch(1)); g.move(1, 200, 100, 1, 390);
    g.followLock(1, 10); g.end(1); const yaw = g.yaw;
    g.followLock(1, 1); expect(g.yaw).toBe(yaw);
  });
  it('归位恢复距离俯仰、清理手势，并朝向角色前方', () => {
    const g = new CameraGesture(); g.begin(touch(1)); g.zoom(2); g.reset(.4);
    const p = orbitPosition(origin, g.yaw, g.pitch, g.distance);
    expect(g.count).toBe(0); expect(g.distance).toBe(CAMERA.distance); expect(g.pitch).toBe(CAMERA.pitch);
    expect(p.x).toBeLessThan(origin.x); expect(p.z).toBeLessThan(origin.z);
  });
});

describe('球面轨道与三维遮挡', () => {
  it('店铺和车辆转过任意角度后的包围范围仍覆盖实际四角', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI / 4]) {
      const b = rotatedBoxBounds(2.55, 1.8, angle);
      for (const x of [-2.55, 2.55]) for (const z of [-1.8, 1.8]) {
        expect(Math.abs(x * Math.cos(angle) - z * Math.sin(angle))).toBeLessThanOrEqual(b.halfWidth + 1e-7);
        expect(Math.abs(x * Math.sin(angle) + z * Math.cos(angle))).toBeLessThanOrEqual(b.halfDepth + 1e-7);
      }
    }
    expect(rotatedBoxBounds(2.55, 1.8, Math.PI).halfWidth).toBeCloseTo(2.55);
  });
  it('全周与不同俯仰均保持角色为圆心和固定半径', () => {
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += Math.PI / 8) for (const pitch of [CAMERA.minPitch, .2, CAMERA.maxPitch]) {
      const p = orbitPosition(origin, yaw, pitch, 8.2);
      expect(Math.hypot(p.x, p.y - origin.y, p.z)).toBeCloseTo(8.2);
    }
  });
  it('近墙收缩可以小于旧的最短距离，离开遮挡恢复完整轨道', () => {
    const wall = { x: 0, z: 2, halfWidth: 3, halfDepth: 1, minY: 0, maxY: 5 };
    const desired = { x: 0, y: 2, z: 10 };
    expect(cameraSafeFraction(origin, desired, [wall], [], floor) * 10).toBeLessThan(.75);
    expect(cameraSafeFraction(origin, { ...desired, z: -10 }, [wall], [], floor)).toBe(1);
  });
  it('低矮柜台上方可通过，低角度则被同一个柜台挡住', () => {
    const counter = { x: 0, z: 3, halfWidth: 1.7, halfDepth: .7, minY: 0, maxY: 1.5 };
    expect(cameraSafeFraction(origin, { x: 0, y: 4, z: 8 }, [counter], [], floor)).toBe(1);
    expect(cameraSafeFraction(origin, { x: 0, y: 1, z: 8 }, [counter], [], floor)).toBeLessThan(1);
  });
  it('窄高建筑仍挡镜头，俯视越过屋顶时不按无限高墙处理', () => {
    const building = { x: 0, z: 4, halfWidth: .8, halfDepth: .8, minY: 0, maxY: 3 };
    expect(cameraSafeFraction(origin, { x: 0, y: 2, z: 9 }, [building], [], floor)).toBeLessThan(1);
    expect(cameraSafeFraction(origin, { x: 0, y: 10, z: 9 }, [building], [], floor)).toBe(1);
  });
  it('摄像机体积在掠过墙角时仍保留余量', () => {
    const building = { x: 1.15, z: 4, halfWidth: 1, halfDepth: 1, minY: 0, maxY: 6 };
    expect(cameraSafeFraction(origin, { x: 0, y: 2, z: 8 }, [building], [], floor)).toBeLessThan(1);
  });
  it('地面起伏和桥面在轨道中段也会阻挡，不能只校验终点', () => {
    const ridge = (_x: number, z: number) => z >= 3 && z <= 4 ? 2 : 0;
    expect(cameraSafeFraction(origin, { x: 0, y: 1.55, z: 8 }, [], [], ridge)).toBeLessThan(.375);
    const p = orbitPosition(origin, 0, CAMERA.minPitch, CAMERA.maxDistance);
    const f = cameraSafeFraction(origin, p, [], [], floor);
    expect(origin.y + (p.y - origin.y) * f).toBeGreaterThanOrEqual(CAMERA.radius);
  });
  it('平滑插值后的对角位置也必须重新避障', () => {
    const wall = { x: 3, z: 3, halfWidth: 1, halfDepth: 1, minY: 0, maxY: 6 };
    expect(cameraSafeFraction(origin, { x: 8, y: 2, z: 0 }, [wall], [], floor)).toBe(1);
    expect(cameraSafeFraction(origin, { x: 0, y: 2, z: 8 }, [wall], [], floor)).toBe(1);
    expect(cameraSafeFraction(origin, { x: 4, y: 2, z: 4 }, [wall], [], floor)).toBeLessThan(1);
  });
  it('地标塔柱有高度遮挡，未声明高度的小道具不收缩镜头', () => {
    const tower = { x: 0, z: 4, radius: 2, minY: 0, maxY: 50 };
    expect(cameraSafeFraction(origin, { x: 0, y: 3, z: 10 }, [], [tower], floor)).toBeLessThan(1);
    expect(cameraSafeFraction(origin, { x: 0, y: 3, z: 10 }, [], [{ x: 0, z: 4, radius: .3 }], floor)).toBe(1);
  });
  it('圆形塔柱侧面不会按矩形包围框把镜头误收缩到角色体内', () => {
    const tower = { x: 0, z: 0, radius: 3, minY: 0, maxY: 50 };
    expect(cameraSafeFraction({ x: 2.6, y: 2, z: 2.6 }, { x: 8, y: 2, z: 8 }, [], [tower], floor)).toBe(1);
  });
});
