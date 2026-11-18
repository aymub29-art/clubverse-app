"use client";

import { useState } from "react";

const events = [
  { date: "24 NOV", type: "WORKSHOP", title: "Build with AI", description: "Explore practical artificial intelligence through hands-on learning." },
  { date: "28 NOV", type: "COMMUNITY", title: "Dev Connect", description: "Meet developers, exchange ideas and discover collaborators." },
  { date: "06 DEC", type: "HACKATHON", title: "CodeStorm Arena", description: "Turn ambitious ideas into working products." },
];

const features = [
  { number: "01", title: "Learn together", description: "Explore technology through workshops, discussions and shared experiences." },
  { number: "02", title: "Build boldly", description: "Turn what you learn into projects, experiments and real solutions." },
  { number: "03", title: "Grow together", description: "Connect with students, developers and creators across campuses." },
];

export default function Home() {
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL"
    ? events
    : events.filter((event) => event.type === filter);

  return (
    <main>
      <div className="announcement">
        <span className="live-dot" />
        GDG ON CAMPUS · RAJEEV INSTITUTE OF TECHNOLOGY
        <span className="announcement-right">HASSAN, INDIA ↗</span>
      </div>

      <header className="header">
        <a href="#home" className="logo">
          <span className="logo-symbol">C<span>.</span></span>
          <span>clubverse</span>
        </a>

        <button className="mobile-menu" onClick={() => setMenu(!menu)}>
          {menu ? "CLOSE ×" : "MENU ☰"}
        </button>

        <nav className={menu ? "nav open" : "nav"}>
          <a href="#about" onClick={() => setMenu(false)}>About</a>
          <a href="#events" onClick={() => setMenu(false)}>Events</a>
          <a href="#community" onClick={() => setMenu(false)}>Community</a>
          <a href="#contact" onClick={() => setMenu(false)}>Contact</a>
        </nav>

        <a href="#events" className="nav-button">Explore events ↗</a>
      </header>

      <section className="hero" id="home">
        <div className="hero-background" />
        <div className="hero-content">
          <div className="eyebrow"><span /> THE CAMPUS BUILDER NETWORK</div>
          <h1>Ideas are just<br />the <em>beginning.</em></h1>
          <p className="hero-description">
            A community for curious minds to meet, make things and move
            what’s next. Learn together. Build boldly. Make your mark.
          </p>
          <div className="hero-buttons">
            <a href="#community" className="primary-button">Discover ClubVerse ↗</a>
            <a href="#about" className="secondary-button">Our story ↓</a>
          </div>
          <div className="hero-proof">
            <div className="avatar-group"><i>A</i><i>B</i><i>C</i><i>+</i></div>
            <div><strong>Built for the curious.</strong><small>Students · Developers · Creators</small></div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-circle"><span>CREATE<br />WITHOUT<br /><em>LIMITS.</em></span></div>
          <div className="floating-card card-one">✳ IDEAS INTO ACTION</div>
          <div className="floating-card card-two">↗ LEARN BY BUILDING</div>
          <div className="floating-star">✳</div>
          <span className="visual-caption">001 — COMMUNITY IN MOTION</span>
        </div>

        <div className="hero-footer"><span>SCROLL TO EXPLORE</span><span className="scroll-line" /><span>EST. RIT HASSAN</span></div>
      </section>

      <section className="about section" id="about">
        <div className="section-label">01 / ABOUT THE COMMUNITY</div>
        <div className="about-layout">
          <h2>Not just a club.<br /><em>A launchpad.</em></h2>
          <div className="about-text">
            <p>
              ClubVerse is the community experience for GDG on Campus at
              Rajeev Institute of Technology, Hassan. A place to explore
              technology, share knowledge and create things that matter.
            </p>
            <a href="#community" className="underlined-link">GET TO KNOW US ↗</a>
          </div>
        </div>
        <div className="principles">
          <div><span>01</span><h3>Stay curious.</h3><p>Explore new ideas and technologies, even if you're starting from zero.</p></div>
          <div><span>02</span><h3>Build together.</h3><p>Different minds create better ideas when they work together.</p></div>
          <div><span>03</span><h3>Make an impact.</h3><p>Turn knowledge into projects and meaningful experiences.</p></div>
        </div>
      </section>

      <section className="events-section" id="events">
        <div className="section section-inner">
          <div className="section-label light">02 / WHAT'S HAPPENING</div>
          <div className="events-heading">
            <h2>Make time for<br /><em>something.</em></h2>
            <p>Workshops, build sessions and experiences that bring our community to life.</p>
          </div>

          <div className="filters">
            {["ALL", "WORKSHOP", "COMMUNITY", "HACKATHON"].map((item) => (
              <button key={item} className={filter === item ? "filter active" : "filter"} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>

          <div className="event-list">
            {filtered.map((event) => (
              <article className="event" key={event.title}>
                <div className="event-date">{event.date.split(" ")[0]}<strong>{event.date.split(" ")[1]}</strong></div>
                <div className="event-info"><span>{event.type}</span><h3>{event.title}</h3><p>{event.description}</p></div>
                <a href="#contact" className="event-arrow" aria-label={"Ask about " + event.title}>↗</a>
              </article>
            ))}
          </div>
          <p className="event-disclaimer">Sample event content — replace with confirmed event information before launch.</p>
        </div>
      </section>

      <section className="community section" id="community">
        <div className="section-label">03 / YOUR NEXT CHAPTER</div>
        <div className="community-heading">
          <h2>Find your<br /><em>kind of people.</em></h2>
          <p>You don't need to know everything. You just need the curiosity to start. There's room here for learners, makers, designers and dreamers.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature" key={feature.number}>
              <div className="feature-number">{feature.number} / 03 <span>✳</span></div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <a href="#contact">↗</a>
            </article>
          ))}
        </div>
        <div className="banner">
          <div><span>YOUR NEXT GREAT THING</span><h3>Could start<br />with you.</h3></div>
          <a href="#contact" className="banner-button">GET CONNECTED ↗</a>
          <div className="banner-decoration">✳</div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="section contact-layout">
          <div>
            <div className="section-label light">04 / LET'S CONNECT</div>
            <h2>Good things<br />are <em>happening.</em></h2>
            <p>Have an idea, want to collaborate or simply want to be part of the community? Reach out.</p>
          </div>
          <div className="contact-details">
            <span>FIND OUR COMMUNITY</span>
            <a href="https://www.instagram.com/gdg_club_rit/" target="_blank" rel="noreferrer">Instagram ↗</a>
            <a href="https://gdg.community.dev/" target="_blank" rel="noreferrer">GDG Community ↗</a>
            <div className="address">Rajeev Institute of Technology<br />Hassan, Karnataka, India</div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <a href="#home" className="logo"><span className="logo-symbol">C<span>.</span></span><span>clubverse</span></a>
        <p>Powered by curiosity. Built together.</p>
        <span>© 2026 GDG ON CAMPUS · RIT HASSAN</span>
      </footer>
    </main>
  );
}
