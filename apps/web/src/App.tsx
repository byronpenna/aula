import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LoginPage } from "./routes/LoginPage";
import { AppShell } from "./routes/AppShell";
import { HomePage } from "./routes/HomePage";
import { CoursesPage } from "./routes/CoursesPage";
import { CourseDetailPage } from "./routes/CourseDetailPage";
import { AssignmentDetailPage } from "./routes/AssignmentDetailPage";
import { MyStudentsPage } from "./routes/MyStudentsPage";
import { StudentSubmissionsPage } from "./routes/StudentSubmissionsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              <Route path="/assignments/:assignmentId" element={<AssignmentDetailPage />} />
              <Route path="/my-students" element={<MyStudentsPage />} />
              <Route path="/students/:studentId/submissions" element={<StudentSubmissionsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
