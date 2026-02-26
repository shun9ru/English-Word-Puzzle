import { useState } from "react";
import "../styles/Login.css";

interface LoginScreenProps {
  onLogin: (userId: string) => void;
  loading: boolean;
  error: string;
}

export function LoginScreen({ onLogin, loading, error }: LoginScreenProps) {
  const [userId, setUserId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;
    if (trimmed.length > 20) return;
    onLogin(trimmed);
  };

  return (
    <div className="login-screen">
      <h1 className="login-screen__title">English Word Puzzle</h1>
      <p className="login-screen__sub">ユーザーIDを入力してログイン</p>

      <form className="login-screen__form" onSubmit={handleSubmit}>
        <input
          className="login-screen__input"
          type="text"
          placeholder="ユーザーID（最大20文字）"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          maxLength={20}
          disabled={loading}
          autoFocus
        />
        <button
          className="login-screen__btn"
          type="submit"
          disabled={loading || !userId.trim()}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      {error && <p className="login-screen__error">{error}</p>}

      <p className="login-screen__note">
        初回ログイン時はアカウントが自動作成されます
      </p>
    </div>
  );
}
