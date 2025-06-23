import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SERVER_URL } from "../components/Constants";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    console.log('[PaymentSuccess] session_id:', sessionId);
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session ID.");
      return;
    }
    fetch(`${SERVER_URL}/api/verify-session?session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        console.log('[PaymentSuccess] verify-session response:', data);
        if (data.success) {
          setStatus("success");
          setMessage("Payment successful! Your Starter Pack is now active.");
          // Show message for 2s, then redirect
          setTimeout(() => {
            // Optionally, show a toast/notification here
            navigate("/app", { state: { toast: "Starter Pack activated! Credits added." } });
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch((err) => {
        console.error('[PaymentSuccess] fetch error:', err);
        setStatus("error");
        setMessage("Verification failed.");
      });
  }, [searchParams, navigate]);

  if (status === "verifying") return <div>Verifying payment...</div>;
  if (status === "success") return <div>{message}<br /><span style={{fontSize:12}}>Redirecting to app...</span></div>;
  return <div style={{ color: "red" }}>{message}</div>;
};

export default PaymentSuccess;
