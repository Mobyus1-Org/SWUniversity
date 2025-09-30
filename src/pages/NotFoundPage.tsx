import { globalBackgroundStyle } from "../util/style-const";

function NotFoundPage() {
  return <div className={`p-4 border h-[85vh] ${globalBackgroundStyle} text-center text-3xl uwd:text-5xl 4k:text-7xl font-bold flex flex-col justify-center items-center`}>
    <h1>404 - Not Found</h1>
    <p>The page you are looking for does not exist.</p>
  </div>;
}

export default NotFoundPage;
