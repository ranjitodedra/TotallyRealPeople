// Demo job descriptions the user can pick instead of pasting their own.
// Text is the public posting, with LinkedIn tracking links removed.

export interface JobTemplate {
  id: string;
  company: string;
  title: string;
  location: string;
  tags: string[];
  /** Brand-ish color for the initial badge. */
  color: string;
  text: string;
}

const SCOTIABANK = `Full Stack Engineer — Global Wealth Engineering, Scotiabank
Location: Toronto, Ontario, Canada

Join a purpose driven winning team, committed to results, in an inclusive and high-performing culture.

The Global Wealth Engineering (GWE) team is continuously modernizing and enhancing the client and account onboarding platforms for Scotia Wealth Management. Our group consists of several agile teams working closely together to deliver, support, and maintain the client and account onboarding systems to provide the best client experience. The team is searching for a client-focused full stack engineer who is motivated to contribute to the development of components of enterprise applications and providing hands-on development and testing on all project assignments.

You will work as part of a team to ensure that the business and technical architecture of the delivered solution matches business requirements. You will be asked to implement various aspects of design and development while working with architects, developers, key business stakeholders, various technical support teams across the Bank, regulatory and compliance groups, and senior leadership. We are looking for an energetic and ambitious individual looking to make a difference for our clients.

Is this role right for you? In this role you will:
- Contribute to the design, development, and implementation of full-stack applications for internal and external-facing systems.
- Work with modern frameworks such as React, Next.js, and Node.js, building components and services under guidance from senior engineers.
- Assist in developing RESTful APIs, integrating with microservices and event streaming platforms (e.g., Kafka, Google Pub/Sub).
- Collaborate with team members to deliver high-quality solutions following Agile development practices.
- Participate in code reviews, follow established coding standards, and continuously improve technical skills.
- Support CI/CD pipelines, automated testing, and deployment processes.
- Apply security-first principles in development, including secure coding practices and API design.
- Troubleshoot and resolve issues in development and production environments with guidance from senior engineers.

Do you have the skills that will enable you to succeed in this role?
- Bachelor's degree in Computer Science, Engineering, or related technical field (or equivalent practical experience).
- 2–4 years of full-stack development experience (internship and/or professional).
- Familiarity with:
  - Front-End: React.js, Next.js, JavaScript (ES6+), TypeScript.
  - Back-End: Node.js, Java (Java 8+), Spring Boot basics.
  - Microservices & REST APIs: Understanding of service-oriented architecture.
  - Event Streaming: Exposure to Kafka or Google Pub/Sub is an asset.
  - Cloud Platforms: Google Cloud (Cloud Run, Cloud Functions basics); Microsoft Azure (App Services, Key Vault basics).
  - DevOps & CI/CD: Basic knowledge of Git, Jenkins, GitHub Actions.
  - Security: Awareness of SSL/TLS, OAuth2, JWT.
  - Databases: SQL (PostgreSQL, Azure SQL), basic NoSQL (MongoDB).
- Understanding of Agile methodologies and SDLC.
- Strong problem-solving skills and willingness to learn.
- Ability to work effectively in cross-functional teams and take direction from senior engineers.
- Experience with containerization (Docker, Kubernetes) – asset.
- Understanding of financial services domain – asset.

What's in it for you?
- Diversity, Equity, Inclusion & Allyship - We strive to create an inclusive culture where every employee is empowered to reach their fullest potential, respected for who they are, and are embraced through bias-free practices and inclusive values across Scotiabank. We embrace diversity and provide opportunities for all employee to learn, grow & participate through our various Employee Resource Groups (ERGs) that span across diverse gender identities, ethnicity, race, age, ability & veterans.
- Accessibility and Workplace Accommodations - We value the unique skills and experiences each individual brings to the Bank, and are committed to creating and maintaining an inclusive and accessible environment for everyone. Scotiabank continues to locate, remove and prevent barriers so that we can build a diverse and inclusive environment while meeting accessibility requirements.
- Upskilling through online courses, cross-functional development opportunities, and tuition assistance.
- Competitive Rewards program including bonus, flexible vacation, personal, sick days and benefits will start on day one.
- Dynamic Ecosystem - Free tea & coffee, universal washrooms, and lots of space for team collaboration.
- Community Engagement - We offer opportunities for community engagement & belonging with our various programs such as hackathons.

Location(s): Canada : Ontario : Toronto

Scotiabank is a leading bank in the Americas. Guided by our purpose: "for every future", we help our customers, their families and their communities achieve success through a broad range of advice, products and services, including personal and commercial banking, wealth management and private banking, corporate and investment banking, and capital markets.

At Scotiabank, we value the unique skills and experiences each individual brings to the Bank, and are committed to creating and maintaining an inclusive and accessible environment for everyone. If you require accommodation (including, but not limited to, an accessible interview site, alternate format documents, ASL Interpreter, or Assistive Technology) during the recruitment and selection process, please let our Recruitment team know. Candidates must apply directly online to be considered for this role. We thank all applicants for their interest in a career at Scotiabank; however, only those candidates who are selected for an interview will be contacted.`;

const STRIPE = `Software Engineer, Intern (Summer or Winter) — Stripe

About Stripe
Stripe is a technology company focused on improving the conditions for economic growth and prosperity. We build programmable financial infrastructure, rethinking from first principles how financial services should work, to make it easier and cheaper for any business to start and scale. More than 10 million businesses build on Stripe, spanning the economic frontier—from solo founders to established enterprises—united by a practical focus on growth. The most ambitious companies in the world use Stripe as core infrastructure to grow faster. They process trillions of dollars a year on Stripe, equivalent to around 1.6% of global GDP. While economic growth makes everyone better off, open markets also enable greater variety. When any business can easily serve a global customer base, the quality and diversity of products in the world increase, and craft and creativity are unleashed into the smallest niches. Our own growth is wholly contingent on the success of the businesses building on Stripe. We therefore invest back into our technology at an unusual rate. We make upgrades to our products every single day to deliver compounding gains to our customers. We maintain some of the most reliable APIs on the internet. We build entirely new pieces of financial infrastructure to enable new ideas. And our significant advances in risk and fraud infrastructure over many years are making the internet economy safer and more accessible.

Though people at Stripe don't tend to take themselves seriously, Stripe is a fairly serious place: our customers are depending on us for their livelihoods. We admire ambition, intensity, curiosity, humility, and rigor. The most effective people become knowledgeable about many domains besides their own. Any company is an applied exercise in understanding some aspect of society or the market. In working with so many (especially the new and innovative ones), we think that Stripe is one of the very best places to learn about how the world works.

What you'll do
As an intern at Stripe you'll work on projects across our stack that directly impact the way millions of businesses operate. You'll own problems end to end with the support of your manager and teammates. It's an opportunity to work alongside some of the most creative and technically rigorous engineers in the industry and learn how to ship high-quality work at scale. By contributing to Stripe's codebase you'll work across domains that give you insight into how the global economy works. Recent intern projects include expanding Stripe's Payments Foundation Model capabilities to improve generalized anomaly detection, building more approachable fraud controls, creating safer payouts, and developing user-facing solutions that prevent costly pricing mistakes and make merchant checkout setup easier.

Our internship program is competitive and the expectations are high.

Responsibilities
- Operate as a real member of the team you join; engage in team discussions, decisions, and the technical design process.
- Write software that will be used in production, and has meaningful impact to Stripe's business and users.
- Give and receive technical feedback through code reviews or design discussions.
- Collaborate with other engineers and cross-functional stakeholders to proactively seek and incorporate feedback.
- Learn quickly by asking great questions, working with your intern manager and teammates effectively, communicating the status of your work clearly, and building with the latest AI tooling.

Who you are
- Ambitious builder: You're energized by building solutions without clear precedent and solving problems with far-reaching consequences. Successful Stripes are deeply curious, and prefer the joy of discovery to the comfort of certainty.
- Rigorous thinker: You appreciate that things worth doing are rarely simple. You enjoy working on problems that have never been tackled before.
- Adaptable problem solver: You adapt quickly and treat obstacles as opportunities. At Stripe we embrace kindness while encouraging Stripes to take measured risks and act boldly, even in the absence of consensus.

Minimum Requirements
- A strong fundamental understanding of computer science through pursuit of a Bachelor's or Master's degree in computer science, math, or a related discipline.
- Experience and familiarity with programming, either through side projects or classwork. We work mostly in Ruby, Java, Javascript, Go, and Scala. We believe new programming languages can be learned if the fundamentals and general knowledge are present.
- Experience from previous internships or other multi-person projects, including open source contributions, that demonstrate evaluating and receiving feedback from mentors, peers, and stakeholders.
- Ability to learn unfamiliar systems and form an understanding of those systems, through independent research and working with a mentor or subject matter experts.
- Ability to leverage AI tools to accelerate development while applying rigorous critical thinking and professional judgement to review, refine, and validate all outputs.

Preferred Qualifications
- At least 1 year of university education, or equivalent work experience.
- One or more areas of specialized knowledge (frontend, backend, infrastructure or other technologies) balanced with general skills and knowledge.
- Experience writing high quality pull requests, with good test coverage, and working knowledge to complete projects with minimal defects.
- Familiarity with navigating and managing your work in new code bases, with multiple languages.
- Clear written communication skills, with the ability to write clearly to explain your work to stakeholders, team members, and other Stripes.

In-office expectations
Office-assigned Stripes in most of our locations are currently expected to spend at least 50% of the time in a given month in their local office or with users. This expectation may vary depending on role, team and location. For example, Stripes in Stripe Delivery Center roles in Mexico City, Mexico, Bengaluru, India, and Dublin, Ireland work 100% from the office. Also, some teams have greater in-office attendance requirements, to appropriately support our users and workflows, which the hiring manager will discuss. This approach helps strike a balance between bringing people together for in-person collaboration and learning from each other, while supporting flexibility when possible.

Pay and benefits
The annual salary range for this role in the primary location is CA$97,500 - CA$97,500. This range may change if you are hired in another location. This salary range may be inclusive of several career levels at Stripe and will be narrowed during the interview process based on a number of factors, including the candidate's experience, qualifications, and specific location. Applicants interested in this role and who are not located in the primary location may request the annual salary range for their location during the interview process.

Specific benefits and details about what compensation is included in the salary range listed above will vary depending on the applicant's location and can be discussed in more detail during the interview process. Benefits/additional compensation for this role may include: equity, company bonus or sales commissions/bonuses; retirement plans; health benefits; and wellness stipends.

At Stripe, we're looking for people with passion, grit, and integrity. You're encouraged to apply even if your experience doesn't precisely match the job description. Your skills and passion will stand out—and set you apart—especially if your career has taken some extraordinary twists and turns. At Stripe, we welcome diverse perspectives and people who think rigorously and aren't afraid to challenge assumptions. Join us.`;

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    id: "scotiabank-fullstack",
    company: "Scotiabank",
    title: "Full Stack Engineer, Global Wealth Engineering",
    location: "Toronto, ON",
    tags: ["React", "Node.js", "Java", "Kafka"],
    color: "#ec111a",
    text: SCOTIABANK,
  },
  {
    id: "stripe-intern",
    company: "Stripe",
    title: "Software Engineer, Intern (Summer or Winter)",
    location: "Canada",
    tags: ["Ruby", "Java", "Go", "Internship"],
    color: "#635bff",
    text: STRIPE,
  },
];
