import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · Recallzy" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-2xl font-bold">Welcome to Recallzy</h1>
      <p className="mt-2 text-center text-sm text-muted">Log in to create quizzes and save your progress.</p>
      <div className="mt-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
