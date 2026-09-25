export const LOGIN_CRITICAL_CSS = String.raw`
html,
body {
  margin: 0;
  min-height: 100%;
  background: #030712;
}
.login-page,
.login-page * {
  box-sizing: border-box;
}
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(12px, 2.8vh, 24px) 16px;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 50% 24%, rgba(62, 77, 139, 0.20), transparent 34%),
    radial-gradient(circle at 15% 85%, rgba(91, 84, 231, 0.06), transparent 30%),
    #030712;
  color: #f7f9ff;
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}
.login-card {
  width: min(100%, 500px);
  padding: 30px 38px 24px;
  border: 1px solid #20293b;
  border-radius: 24px;
  background: linear-gradient(180deg, #080d18 0%, #070c16 100%);
  box-shadow: 0 22px 62px rgba(0, 0, 0, 0.44);
  text-align: center;
}
.login-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(245, 165, 36, 0.18);
  border-radius: 17px;
  background: rgba(245, 165, 36, 0.08);
  color: #f5a524;
}
.login-icon svg {
  width: 32px;
  height: 32px;
  stroke-width: 2;
}
.login-icon--builder {
  width: 64px;
  height: 56px;
  margin-bottom: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.login-icon--builder svg {
  width: 58px;
  height: 52px;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}
.login-icon--builder .builder-mark-gold { stroke: #f4b01f; }
.login-icon--builder .builder-mark-red { stroke: #ff4a67; }
.login-card h1 {
  margin: 0;
  color: #f9fbff;
  font-size: clamp(28px, 3.4vw, 34px);
  font-weight: 850;
  letter-spacing: -0.035em;
  line-height: 1.08;
}
.login-context {
  margin: 8px 0 24px;
  color: #7f8da7;
  font-size: 14px;
  line-height: 1.45;
}
.login-context b {
  color: #7775ff;
  font-weight: 850;
  overflow-wrap: anywhere;
}
.login-card form {
  text-align: left;
}
.login-card label {
  display: block;
  margin-bottom: 18px;
}
.login-card label > span {
  display: block;
  margin-bottom: 8px;
  color: #aab5ca;
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.08em;
}
.login-input {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #29344a;
  border-radius: 14px;
  background: #0e1420;
  padding: 0 14px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}
.login-input:focus-within {
  border-color: #696cff;
  background: #101725;
  box-shadow: 0 0 0 3px rgba(101, 105, 255, 0.14);
}
.login-input > svg {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  color: #6f7d96;
}
.login-input input {
  min-width: 0;
  height: 54px;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f7f9ff;
  font: inherit;
  font-size: 15px;
}
.login-input input::placeholder {
  color: #7c879b;
  opacity: 1;
}
.login-input button {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #8996ac;
  cursor: pointer;
}
.login-input button:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #d8dfeb;
}
.login-input button:focus-visible,
.login-submit:focus-visible,
.back-link:focus-visible {
  outline: 3px solid rgba(119, 117, 255, 0.45);
  outline-offset: 3px;
}
.login-input button svg {
  width: 19px;
  height: 19px;
}
.login-hint {
  display: block;
  margin: -6px 0 18px;
  color: #8290a8;
  font-size: 12px;
  line-height: 1.45;
}
.login-error {
  margin: -4px 0 16px;
  padding: 10px 12px;
  border: 1px solid #713046;
  border-radius: 10px;
  background: #351621;
  color: #ff9aab;
  font-size: 12px;
  line-height: 1.4;
}
.login-submit {
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #5f66ed, #7166f4);
  box-shadow: 0 10px 26px rgba(76, 81, 219, 0.22);
  color: #fff;
  font: inherit;
  font-size: 16px;
  font-weight: 850;
  cursor: pointer;
  transition: transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease;
}
.login-submit:not(:disabled):active { transform: translateY(1px); }
.login-submit:not(:disabled):hover { filter: brightness(1.05); }
.login-submit:disabled { cursor: wait; opacity: 0.62; }
.back-link {
  display: inline-block;
  margin-top: 22px;
  color: #9aa7bd;
  font-size: 13px;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.back-link:hover { color: #fff; }
@media (max-width: 600px) {
  .login-page { padding: 14px 12px; }
  .login-card { width: min(100%, 440px); padding: 24px 20px 20px; border-radius: 21px; }
  .login-icon { width: 54px; height: 54px; margin-bottom: 12px; border-radius: 16px; }
  .login-icon svg { width: 30px; height: 30px; }
  .login-icon--builder { width: 60px; height: 50px; margin-bottom: 8px; border-radius: 0; }
  .login-icon--builder svg { width: 54px; height: 48px; }
  .login-card h1 { font-size: clamp(27px, 8vw, 32px); }
  .login-context { margin: 7px 0 20px; font-size: 13px; }
  .login-card label { margin-bottom: 16px; }
  .login-input { min-height: 52px; border-radius: 13px; }
  .login-input input { height: 50px; font-size: 14px; }
  .login-submit { min-height: 52px; font-size: 15px; }
  .back-link { margin-top: 18px; }
}
@media (max-height: 680px) and (min-width: 601px) {
  .login-page { padding-block: 10px; }
  .login-card { padding: 22px 34px 18px; }
  .login-icon { width: 50px; height: 50px; margin-bottom: 9px; }
  .login-icon--builder { width: 56px; height: 46px; margin-bottom: 6px; }
  .login-icon--builder svg { width: 50px; height: 44px; }
  .login-card h1 { font-size: 28px; }
  .login-context { margin: 6px 0 18px; }
  .login-card label { margin-bottom: 14px; }
  .login-input { min-height: 50px; }
  .login-input input { height: 48px; }
  .login-submit { min-height: 50px; }
  .back-link { margin-top: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .login-input,
  .login-submit { transition: none; }
}
`;
