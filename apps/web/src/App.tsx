import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LoginPage } from "./routes/LoginPage";
import { CallbackPage } from "./routes/CallbackPage";
import { AppShell } from "./routes/AppShell";
import { HomePage } from "./routes/HomePage";
import { CoursesPage } from "./routes/CoursesPage";
import { CourseDetailPage } from "./routes/CourseDetailPage";
import { BooksPage } from "./routes/BooksPage";
import { BookDetailPage } from "./routes/BookDetailPage";
import { MyBooksPage } from "./routes/MyBooksPage";
import { BooksAdminPage } from "./routes/BooksAdminPage";
import { AssignmentDetailPage } from "./routes/AssignmentDetailPage";
import { MyStudentsPage } from "./routes/MyStudentsPage";
import { StudentDetailPage } from "./routes/StudentDetailPage";
import { StudentSubmissionsPage } from "./routes/StudentSubmissionsPage";
import { AcademicsAdminPage } from "./routes/AcademicsAdminPage";
import { AdminLayout } from "./routes/AdminLayout";
import { AdminDashboardPage } from "./routes/AdminDashboardPage";
import { AdminUsersPage } from "./routes/AdminUsersPage";
import { AdminRolesPage } from "./routes/AdminRolesPage";
import { BillingAdminPage } from "./routes/BillingAdminPage";
import { AccountingPage } from "./routes/AccountingPage";

// Carga perezosa a propósito: arrastra pdfjs-dist y epubjs (~800kB juntos), que
// no deben inflar el bundle principal para quien nunca abre un libro.
const BookReaderPage = lazy(() =>
  import("./routes/BookReaderPage").then((m) => ({ default: m.BookReaderPage })),
);

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
            <Route path="/callback" element={<CallbackPage />} />
            {/* Fuera de <AppShell> a propósito: lector de libros a pantalla
                completa, sin el header/nav del sitio (ver BookReaderPage.tsx). */}
            <Route
              path="/books/:bookId/read"
              element={
                <Suspense
                  fallback={
                    <div className="flex h-dvh items-center justify-center bg-slate-900 text-sm text-slate-300">
                      Cargando…
                    </div>
                  }
                >
                  <BookReaderPage />
                </Suspense>
              }
            />
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              <Route path="/assignments/:assignmentId" element={<AssignmentDetailPage />} />
              <Route path="/books" element={<BooksPage />} />
              <Route path="/books/:bookId" element={<BookDetailPage />} />
              <Route path="/mis-libros" element={<MyBooksPage />} />
              <Route path="/my-students" element={<MyStudentsPage />} />
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/academics" element={<AcademicsAdminPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/roles" element={<AdminRolesPage />} />
                <Route path="/admin/billing" element={<BillingAdminPage />} />
                <Route path="/admin/accounting" element={<AccountingPage />} />
                <Route path="/admin/books" element={<BooksAdminPage />} />
              </Route>
              <Route path="/students/:studentId" element={<StudentDetailPage />} />
              <Route path="/students/:studentId/submissions" element={<StudentSubmissionsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
