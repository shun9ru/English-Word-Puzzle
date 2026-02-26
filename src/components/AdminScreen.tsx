/**
 * 管理者画面
 */

import { useState, useEffect, useCallback } from "react";
import { getAllUsers, addGachaPointsDB, deleteUser } from "../lib/userService";
import type { UserRecord } from "../lib/userService";
import { supabase } from "../lib/supabase";
import "../styles/Admin.css";

interface AdminScreenProps {
  onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AdminScreen({ onBack }: AdminScreenProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPlays, setTotalPlays] = useState(0);
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allUsers, countResult] = await Promise.all([
        getAllUsers(),
        supabase.from("scores").select("id", { count: "exact", head: true }),
      ]);
      setUsers(allUsers);
      setTotalPlays(countResult.count ?? 0);
    } catch {
      setMessage("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddPoints = useCallback(async (userId: string) => {
    const amount = parseInt(pointsInput[userId] ?? "", 10);
    if (isNaN(amount) || amount <= 0) {
      setMessage("正の数値を入力してください");
      return;
    }
    try {
      await addGachaPointsDB(userId, amount);
      setMessage(`${userId} に ${amount}pt を付与しました`);
      setPointsInput((prev) => ({ ...prev, [userId]: "" }));
      await fetchData();
    } catch {
      setMessage("ポイント付与に失敗しました");
    }
  }, [pointsInput, fetchData]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!window.confirm(`ユーザー「${userId}」を削除しますか？\nすべてのデータが削除されます。`)) return;
    try {
      await deleteUser(userId);
      setMessage(`ユーザー「${userId}」を削除しました`);
      await fetchData();
    } catch {
      setMessage("ユーザー削除に失敗しました");
    }
  }, [fetchData]);

  if (loading) {
    return <div className="admin-screen"><p>読み込み中...</p></div>;
  }

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">管理者画面</h1>

      <div className="admin-screen__stats">
        <div className="admin-screen__stat">
          <span className="admin-screen__stat-label">総ユーザー数</span>
          <span className="admin-screen__stat-value">{users.length}</span>
        </div>
        <div className="admin-screen__stat">
          <span className="admin-screen__stat-label">総プレイ回数</span>
          <span className="admin-screen__stat-value">{totalPlays}</span>
        </div>
      </div>

      {message && <p className="admin-screen__message">{message}</p>}

      <div className="admin-screen__section">
        <h2>ユーザー一覧</h2>
        <div className="admin-screen__table-wrap">
          <table className="admin-screen__table">
            <thead>
              <tr>
                <th>ID</th>
                <th>作成日</th>
                <th>最終ログイン</th>
                <th>ポイント</th>
                <th>ポイント付与</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_admin ? "admin-screen__row--admin" : ""}>
                  <td>
                    {u.id}
                    {u.is_admin && <span className="admin-screen__badge">Admin</span>}
                  </td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>{formatDate(u.last_login_at)}</td>
                  <td className="admin-screen__points">{u.gacha_points}pt</td>
                  <td>
                    <div className="admin-screen__points-form">
                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={pointsInput[u.id] ?? ""}
                        onChange={(e) => setPointsInput((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        className="admin-screen__points-input"
                      />
                      <button
                        className="admin-screen__btn admin-screen__btn--add"
                        onClick={() => handleAddPoints(u.id)}
                      >
                        付与
                      </button>
                    </div>
                  </td>
                  <td>
                    {!u.is_admin && (
                      <button
                        className="admin-screen__btn admin-screen__btn--delete"
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button className="admin-screen__back-btn" onClick={onBack}>
        もどる
      </button>
    </div>
  );
}
