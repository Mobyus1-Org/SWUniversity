import { globalBackgroundStyle } from "../util/style-const";

function AboutPage() {
  return <div className={`p-20 border h-[85vh] ${globalBackgroundStyle}
      text-center text-3xl uwd:text-5xl 4k:text-7xl font-bold flex flex-col gap-12`}>
    <h1 className="text-7xl">About Us</h1>
    <p>Learn more about our mission, vision, and values. Would you happen to have a minute to talk about the Midichlorians?</p>
  </div>;
}

export default AboutPage;
