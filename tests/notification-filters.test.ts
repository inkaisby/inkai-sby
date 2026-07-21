import { describe, expect, it } from "vitest";
import {
  filterNotificationsForCurrentUser,
  filterNotificationsForMemberInbox,
  isAdminOpsNotification,
  isMemberPersonalNotification,
  withFilterStats,
} from "../src/lib/notification-filters";

describe("notification audience filters", () => {
  const me = "user-me";

  it("filterNotificationsForCurrentUser keeps only own userId", () => {
    const items = [
      { id: "1", userId: me, title: "Mine" },
      { id: "2", userId: "other", title: "Other" },
      { id: "3", title: "No userId" },
    ];
    expect(filterNotificationsForCurrentUser(me, items).map((n) => n.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("member inbox hides ADMIN audience and admin-ops titles", () => {
    const items = [
      {
        id: "1",
        userId: me,
        audience: "ADMIN",
        title: "Anggota mendaftar kegiatan mandiri",
        content: "X (GADING) mendaftar sendiri untuk 'UKT'",
      },
      {
        id: "2",
        userId: me,
        audience: "MEMBER",
        title: "Data keanggotaan diperbarui",
        content: "Sabuk/Kyu Anda diperbarui menjadi Kuning",
      },
      {
        id: "3",
        userId: me,
        audience: "BROADCAST",
        title: "Pengumuman",
        content: "Latihan libur",
      },
      {
        id: "4",
        userId: me,
        title: "Anggota mendaftar kegiatan mandiri",
        content: "Y (JWON) mendaftar sendiri untuk 'event'",
      },
    ];
    const out = filterNotificationsForMemberInbox(me, items);
    expect(out.map((n) => n.id)).toEqual(["2", "3"]);
  });

  it("isAdminOpsNotification prefers audience over title", () => {
    expect(
      isAdminOpsNotification({
        audience: "ADMIN",
        title: "Anything",
        content: "",
      }),
    ).toBe(true);
    expect(
      isAdminOpsNotification({
        audience: "MEMBER",
        title: "Anggota mendaftar kegiatan mandiri",
        content: "x",
      }),
    ).toBe(false);
  });

  it("isMemberPersonalNotification prefers audience", () => {
    expect(
      isMemberPersonalNotification({
        audience: "MEMBER",
        title: "X",
        content: "",
      }),
    ).toBe(true);
    expect(
      isMemberPersonalNotification({
        audience: "ADMIN",
        title: "Data keanggotaan diperbarui",
        content: "Sabuk/Kyu Anda",
      }),
    ).toBe(false);
  });

  it("withFilterStats reports dropped count", () => {
    const { stats } = withFilterStats([1, 2, 3], [1]);
    expect(stats).toEqual({ input: 3, output: 1, dropped: 2 });
  });
});
